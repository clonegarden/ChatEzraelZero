module.exports = {
  IP_MATCH_PREFIX: 7,        // Tamanho do prefixo IP para comparação
  MAX_FINGERPRINTS: 5,        // Máximo de fingerprints armazenadas
  MAX_IPS: 10,                // Máximo de IPs armazenados
  CONFIDENCE_WEIGHTS: {       // Pesos para cálculo de confiança
    fingerprints: 30,
    ips: 20,
    visits: 25,
    name: 15,
    temperament: 10
  }
};