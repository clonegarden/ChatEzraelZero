const crypto = require('crypto');
const supabase = require('./db');
const config = require('./recognitionConfig');

class UserRecognition {
  constructor() {
    this.IP_PREFIX_LENGTH = config.IP_MATCH_PREFIX || 7;
  }

  generateBrowserFingerprint(req) {
    const h = req.headers;
    const components = [
      h['user-agent'],
      h['accept-language'],
      h['sec-ch-ua-platform'],
      h['sec-ch-ua'],
    ].filter(Boolean).join('|');
    return crypto.createHash('sha256').update(components).digest('hex');
  }

  // DB row → profile object (same external shape as before)
  _fromDB(row) {
    if (!row) return null;
    return {
      userId:      row.user_id,
      fingerprints: row.fingerprints || [],
      ips:          row.ips || [],
      visitCount:  row.visit_count || 0,
      firstSeen:   row.first_seen,
      lastSeen:    row.last_seen,
      nome:        row.username || row.profile_data?.nome,
      ...(row.profile_data || {})
    };
  }

  // Profile object → DB row
  _toDB(profile) {
    const { userId, fingerprints, ips, visitCount, firstSeen, lastSeen, nome, ...rest } = profile;
    const ipPrefixes = [...new Set((ips || []).map(ip => ip.substring(0, this.IP_PREFIX_LENGTH)))];

    return {
      user_id:     userId,
      fingerprints: fingerprints || [],
      ips:          ips || [],
      ip_prefixes:  ipPrefixes,
      username:    nome || null,
      visit_count: visitCount || 0,
      first_seen:  firstSeen || new Date().toISOString(),
      last_seen:   lastSeen || new Date().toISOString(),
      profile_data: { nome, ...rest }
    };
  }

  async findUserByFingerprint(req) {
    const fp = this.generateBrowserFingerprint(req);
    const ipPrefix = req.ip.substring(0, this.IP_PREFIX_LENGTH);

    // Try fingerprint first (GIN index)
    const { data: byFp } = await supabase
      .from('ezrael_recognition_profiles')
      .select('*')
      .contains('fingerprints', [fp])
      .maybeSingle();

    if (byFp) return this._fromDB(byFp);

    // Fallback: IP prefix (GIN index)
    const { data: byIP } = await supabase
      .from('ezrael_recognition_profiles')
      .select('*')
      .contains('ip_prefixes', [ipPrefix])
      .maybeSingle();

    return this._fromDB(byIP);
  }

  async identifyRecurrentUser(existingProfile, req, userInput = '') {
    const dbProfile = await this.findUserByFingerprint(req);
    if (dbProfile) {
      return await this.updateRecurrenceProfile(dbProfile, req, false);
    }

    if (!existingProfile) return null;

    const fp = this.generateBrowserFingerprint(req);
    if (existingProfile.fingerprints?.includes(fp)) return existingProfile;

    const isSimilarIP = existingProfile.ips?.some(ip =>
      ip.substring(0, this.IP_PREFIX_LENGTH) === req.ip.substring(0, this.IP_PREFIX_LENGTH)
    );
    if (isSimilarIP) return existingProfile;

    if (userInput) {
      const modal = this.extractModalLogic(userInput);
      if (existingProfile.modal_trace?.includes(modal)) return existingProfile;
    }

    return null;
  }

  async updateRecurrenceProfile(profile, req, isNew = false) {
    const updated = { ...profile };
    updated.visitCount = (profile.visitCount || 0) + 1;
    updated.lastSeen = new Date().toISOString();

    const fp = this.generateBrowserFingerprint(req);
    updated.fingerprints = [...new Set([...(profile.fingerprints || []), fp])].slice(0, config.MAX_FINGERPRINTS || 5);
    updated.ips = [...new Set([req.ip, ...(profile.ips || [])])].slice(0, config.MAX_IPS || 10);

    if (isNew) {
      updated.firstSeen = new Date().toISOString();
      updated.userId = updated.userId || this.generateUserId();
    }

    await this.saveUserProfile(updated);
    return updated;
  }

  generateUserId() {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveUserProfile(profile) {
    const { error } = await supabase
      .from('ezrael_recognition_profiles')
      .upsert(this._toDB(profile), { onConflict: 'user_id' });

    if (error) console.error('[UserRecognition] saveUserProfile:', error.message);
  }

  async findUserByName(username) {
    const { data } = await supabase
      .from('ezrael_recognition_profiles')
      .select('*')
      .ilike('username', username)
      .maybeSingle();

    return this._fromDB(data);
  }

  async saveBehavioralPattern(userId, pattern) {
    const { data } = await supabase
      .from('ezrael_behavioral_patterns')
      .select('patterns')
      .eq('user_id', userId)
      .maybeSingle();

    const existing = data?.patterns || [];
    const updated = [...new Set([...existing, pattern])].slice(-20);

    await supabase
      .from('ezrael_behavioral_patterns')
      .upsert({ user_id: userId, patterns: updated, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  }

  async getBehavioralPatterns(userId) {
    const { data } = await supabase
      .from('ezrael_behavioral_patterns')
      .select('patterns')
      .eq('user_id', userId)
      .maybeSingle();

    return data?.patterns || [];
  }

  extractModalLogic(message) {
    const seeds = ['□', '◇', '⊕', '¬', '→', '↯', '☯', '⚖', '✂', '∴'];
    const keywords = message.toLowerCase().match(/\b\w+\b/g) || [];
    const hash = crypto.createHash('md5').update(message).digest('hex');
    const index = parseInt(hash.slice(0, 2), 16);
    const symbol = seeds[index % seeds.length];
    const keyword = keywords[index % keywords.length] || 'x';
    return `${symbol}${keyword.charAt(0).toUpperCase()}`;
  }

  calculateConfidence(profile) {
    let confidence = 0;
    const w = config.CONFIDENCE_WEIGHTS;
    if (profile.fingerprints?.length > 1) confidence += w.fingerprints;
    if (profile.ips?.length > 2)          confidence += w.ips;
    if (profile.visitCount > 3)           confidence += w.visits;
    if (profile.nome)                     confidence += w.name;
    if (profile.temperamento)             confidence += w.temperament;
    return Math.min(confidence, 100);
  }

  async createNewUserProfile(req, initialData = {}) {
    const fp = this.generateBrowserFingerprint(req);
    const userId = this.generateUserId();

    const profile = {
      userId,
      fingerprints: [fp],
      ips: [req.ip],
      visitCount: 1,
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      modal_trace: [],
      ...initialData
    };

    await this.saveUserProfile(profile);
    return profile;
  }

  async mergeUserProfiles(profile1, profile2) {
    const merged = {
      userId: profile1.userId,
      fingerprints: [...new Set([...(profile1.fingerprints || []), ...(profile2.fingerprints || [])])].slice(0, config.MAX_FINGERPRINTS),
      ips: [...new Set([...(profile1.ips || []), ...(profile2.ips || [])])].slice(0, config.MAX_IPS),
      visitCount: (profile1.visitCount || 0) + (profile2.visitCount || 0),
      firstSeen: profile1.firstSeen < profile2.firstSeen ? profile1.firstSeen : profile2.firstSeen,
      lastSeen: profile1.lastSeen > profile2.lastSeen ? profile1.lastSeen : profile2.lastSeen,
      modal_trace: [...new Set([...(profile1.modal_trace || []), ...(profile2.modal_trace || [])])],
      nome: profile1.nome || profile2.nome,
      temperamento: profile1.temperamento || profile2.temperamento
    };

    await this.saveUserProfile(merged);
    await this.deleteUserProfile(profile2.userId);
    return merged;
  }

  async deleteUserProfile(userId) {
    // Cascade in SQL handles behavioral_patterns
    const { error } = await supabase
      .from('ezrael_recognition_profiles')
      .delete()
      .eq('user_id', userId);

    if (error) console.error('[UserRecognition] deleteUserProfile:', error.message);
  }
}

module.exports = new UserRecognition();
