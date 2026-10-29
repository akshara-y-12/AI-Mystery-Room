import mongoose from 'mongoose';

const caseSchema = new mongoose.Schema({
  caseCode: { type: String, required: true }, ownerSessionId: { type: String, required: true, index: true },
  title: String, scenario: String, category: String, difficulty: String, status: String,
  incident: mongoose.Schema.Types.Mixed, suspects: [mongoose.Schema.Types.Mixed],
  evidence: [mongoose.Schema.Types.Mixed], timeline: [mongoose.Schema.Types.Mixed],
  examinedEvidenceIds: [String], accusation: mongoose.Schema.Types.Mixed,
  solution: mongoose.Schema.Types.Mixed, generationMetadata: mongoose.Schema.Types.Mixed,
}, { timestamps: true, minimize: false });

export const CaseModel = mongoose.models.Case || mongoose.model('Case', caseSchema);
