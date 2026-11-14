// Vercel's Express adapter discovers this entry. The build emits the same app
// used by the local Node server; importing it does not start a listener.
import express from 'express';
import app from './dist/index.js';

// The import is intentional: Vercel's framework detection recognizes Express.
void express;
export default app;
