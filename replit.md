# Chat Anamnesis - AI Mystical Chatbot

## Overview

This is a Node.js-based AI chatbot application called "Ezrael Noetiko" that combines conversational AI with mystical/esoteric elements. The system features a web-based chat interface with user authentication, persistent memory management, and multiple AI provider integrations. The application uses advanced user recognition techniques and implements mystical personality systems with planetary hour calculations to create a unique conversational experience.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Backend Architecture
- **Framework**: Express.js server with CORS configuration for cross-origin requests
- **Entry Point**: Simple index.js that requires the main server file
- **Authentication**: Custom authentication system with in-memory user storage and cookie-based session management
- **Memory Management**: Sophisticated conversation memory system with token estimation and session persistence
- **User Recognition**: Advanced fingerprinting system using browser characteristics and IP tracking for recurring user identification

### Frontend Architecture
- **Technology**: Vanilla JavaScript with HTML/CSS
- **Interface**: Single-page chat application with mystical theming
- **Authentication UI**: Login/register forms with form switching
- **Session Management**: Local storage for conversation history and session persistence
- **Visual Effects**: Mystical animations and teal color scheme

### Data Storage Solutions
- **Primary Database**: Replit Database for persistent storage
- **Session Storage**: In-memory Map for active sessions
- **Local Storage**: Browser-based storage for conversation history
- **Cookie Management**: Signed cookies for user profile persistence with HMAC-SHA256 signatures

### Authentication and Authorization
- **Cookie-Based Sessions**: Custom signed cookie implementation for user profiles
- **User Recognition**: Multi-factor recognition system combining IP addresses, browser fingerprints, and behavioral patterns
- **Profile Management**: Automatic temperament inference and personality adaptation based on user interactions

### AI Integration Architecture
- **Multiple Providers**: Support for both OpenAI and Anthropic Claude APIs
- **Personality System**: Complex mystical personality framework with planetary hour calculations
- **Memory Context**: Token-aware conversation management with automatic truncation
- **Response Variation**: Anti-repetition algorithms and dynamic response adaptation

## External Dependencies

### AI Services
- **OpenAI API**: Primary conversational AI provider
- **Anthropic Claude**: Alternative AI provider for enhanced capabilities

### Google Cloud Services
- **Text-to-Speech**: Audio response generation capabilities
- **Cloud Storage**: File storage and management for generated audio content

### Vector Database
- **Pinecone**: Vector database integration for semantic search and memory enhancement

### Core Infrastructure
- **Replit Database**: Managed database service for persistent data storage
- **Express.js**: Web framework for HTTP server implementation
- **CORS**: Cross-origin resource sharing for frontend-backend communication

### Security and Utilities
- **Cookie Parser**: HTTP cookie parsing middleware
- **Crypto Module**: Native Node.js cryptographic functions for security operations
- **HMAC Signatures**: Cookie signing and verification for tamper protection

### Development Dependencies
- **Node.js Runtime**: JavaScript runtime environment
- **NPM**: Package management and dependency resolution