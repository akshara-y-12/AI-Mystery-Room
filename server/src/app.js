import crypto from 'node:crypto';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import { CaseModel } from './models/Case.js';
import { validateScenario } from './services/caseValidationService.js';
import { generateCase, newCaseRecord } from './services/caseGenerationService.js';

const memoryCases = new Map();
const hasDb = () => mongoose.connection.readyState === 1;
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be configured in production.');
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }));
app.use(express.json({ limit: '32kb' }));
app.use(session({
  name: 'mystery.sid', secret: sessionSecret,
  resave: false, saveUninitialized: false, rolling: true,
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: Number(process.env.SESSION_TTL_HOURS || 24) * 3600000 },
  ...(process.env.MONGODB_URI ? { store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI, collectionName: 'sessions', ttl: Number(process.env.SESSION_TTL_HOURS || 24) * 3600 }) } : {}),
}));
app.use((req, _res, next) => { if (!req.session.ownerId) req.session.ownerId = crypto.randomUUID(); next(); });
const generationLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 5, standardHeaders: 'draft-7', legacyHeaders: false, keyGenerator: (req) => req.session.ownerId, message: { success: false, error: { code: 'RATE_LIMIT_EXCEEDED', message: 'You have started several cases recently. Please try again in an hour.' } } });

function publicCase(record) {
  const value = record.toObject ? record.toObject() : record;
  return { caseId: String(value._id || value.id), caseCode: value.caseCode, title: value.title, scenario: value.scenario, category: value.category, difficulty: value.difficulty, status: value.status, incident: value.incident, suspects: value.suspects.map(({ id, name, age, occupation, relationship, background, alibi, portraitAssetId }) => ({ id, name, age, occupation, relationship, background, alibi, portraitAssetId })), evidence: value.evidence, timeline: value.timeline, examinedEvidenceIds: value.examinedEvidenceIds || [], accusationStatus: value.accusation ? 'submitted' : 'pending', progress: { examined: (value.examinedEvidenceIds || []).length, total: value.evidence.length } };
}
async function findCase(id, owner) {
  const record = hasDb() ? await CaseModel.findById(id) : memoryCases.get(id);
  if (!record) return null;
  if (String(record.ownerSessionId) !== owner) { const e = new Error('You do not have access to this case.'); e.status = 403; e.code = 'FORBIDDEN'; throw e; }
  return record;
}
function sendError(res, error) { const status = error.status || 500; if (status === 500) console.error(error); res.status(status).json({ success: false, error: { code: error.code || 'INTERNAL_SERVER_ERROR', message: status === 500 ? 'Something went wrong. Please try again.' : error.message } }); }

app.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));
app.post('/api/v1/cases', generationLimit, async (req, res) => {
  try {
    const config = validateScenario(req.body || {});
    const generated = await generateCase(config);
    const record = newCaseRecord(config, generated, req.session.ownerId);
    if (hasDb()) { const created = await CaseModel.create(record); return res.status(201).json({ success: true, data: { caseId: String(created._id), title: created.title, status: created.status, provider: generated.provider, caseUrl: `/case/${created._id}` } }); }
    const id = crypto.randomUUID(); memoryCases.set(id, { ...record, id });
    return res.status(201).json({ success: true, data: { caseId: id, title: record.title, status: record.status, provider: generated.provider, caseUrl: `/case/${id}` } });
  } catch (e) { sendError(res, e); }
});
app.get('/api/v1/cases/:caseId', async (req, res) => {
  try { const record = await findCase(req.params.caseId, req.session.ownerId); if (!record) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'This case file could not be found.' } }); if (record.status !== 'active' && record.status !== 'completed') return res.status(409).json({ success: false, error: { code: 'CASE_NOT_ACTIVE', message: 'This investigation is not active.' } }); return res.json({ success: true, data: publicCase(record) }); }
  catch (e) { sendError(res, e); }
});
app.post('/api/v1/cases/:caseId/evidence/:evidenceId/examine', async (req, res) => {
  try { const record = await findCase(req.params.caseId, req.session.ownerId); if (!record) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'This case file could not be found.' } }); if (record.status !== 'active') return res.status(409).json({ success: false, error: { code: 'CASE_NOT_ACTIVE', message: 'This investigation is already complete.' } }); if (!record.evidence.some((item) => item.id === req.params.evidenceId)) return res.status(404).json({ success: false, error: { code: 'EVIDENCE_NOT_FOUND', message: 'That evidence is not part of this case.' } }); if (!record.examinedEvidenceIds.includes(req.params.evidenceId)) { record.examinedEvidenceIds.push(req.params.evidenceId); if (hasDb()) await record.save(); }
    return res.json({ success: true, data: { examinedEvidenceIds: record.examinedEvidenceIds, progress: { examined: record.examinedEvidenceIds.length, total: record.evidence.length, percentage: Math.round(record.examinedEvidenceIds.length / record.evidence.length * 100) } } }); }
  catch (e) { sendError(res, e); }
});
app.post('/api/v1/cases/:caseId/accusation', async (req, res) => {
  try { const record = await findCase(req.params.caseId, req.session.ownerId); if (!record) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'This case file could not be found.' } }); if (record.status !== 'active') return res.status(409).json({ success: false, error: { code: 'ACCUSATION_ALREADY_SUBMITTED', message: 'An accusation has already been submitted for this case.' } }); const suspectId = req.body?.suspectId; if (!record.suspects.some((s) => s.id === suspectId)) return res.status(400).json({ success: false, error: { code: 'INVALID_SUSPECT', message: 'Select a suspect from this case.' } }); const accusation = { suspectId, isCorrect: suspectId === record.solution.culpritSuspectId, submittedAt: new Date() };
    if (hasDb()) {
      const updated = await CaseModel.findOneAndUpdate({ _id: record._id, ownerSessionId: req.session.ownerId, status: 'active', accusation: null }, { $set: { accusation, status: 'completed' } }, { new: true });
      if (!updated) return res.status(409).json({ success: false, error: { code: 'ACCUSATION_ALREADY_SUBMITTED', message: 'An accusation has already been submitted for this case.' } });
    } else { record.accusation = accusation; record.status = 'completed'; }
    return res.json({ success: true, data: { isCorrect: accusation.isCorrect, status: 'completed', resultUrl: `/case/${req.params.caseId}/result` } }); }
  catch (e) { sendError(res, e); }
});
app.get('/api/v1/cases/:caseId/solution', async (req, res) => {
  try { const record = await findCase(req.params.caseId, req.session.ownerId); if (!record) return res.status(404).json({ success: false, error: { code: 'CASE_NOT_FOUND', message: 'This case file could not be found.' } }); if (!record.accusation || record.status !== 'completed') return res.status(403).json({ success: false, error: { code: 'SOLUTION_NOT_AVAILABLE', message: 'Submit your final accusation to reveal the solution.' } }); const culprit = record.suspects.find((s) => s.id === record.solution.culpritSuspectId); return res.json({ success: true, data: { isCorrect: record.accusation.isCorrect, accusation: { suspectId: record.accusation.suspectId, submittedAt: record.accusation.submittedAt }, culprit: { id: culprit.id, name: culprit.name, occupation: culprit.occupation, relationship: culprit.relationship }, culpritSuspectId: record.solution.culpritSuspectId, motive: record.solution.motive, explanation: record.solution.explanation, evidenceReasoning: record.solution.evidenceReasoning, misleadingClues: record.solution.misleadingClues, reconstruction: record.solution.reconstruction } }); }
  catch (e) { sendError(res, e); }
});
app.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'That endpoint does not exist.' } }));
app.use((error, _req, res, _next) => sendError(res, error));

export default app;
