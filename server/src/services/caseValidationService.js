
const evidenceTypes = new Set([
  'chat',
  'image',
  'cctv',
  'witness_statement',
  'document',
  'physical',
  'timeline',
]);

const nonEmpty = (value) =>
  typeof value === 'string' && value.trim().length > 0;

export function validateScenario(body) {
  const scenario =
    typeof body.scenario === 'string' ? body.scenario.trim() : '';

  if (scenario.length < 30 || scenario.length > 2000) {
    const error = new Error(
      'Please provide a scenario between 30 and 2,000 characters.'
    );
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const difficulty = ['easy', 'medium', 'hard'].includes(body.difficulty)
    ? body.difficulty
    : 'medium';

  const counts = {
    easy: [3, 4],
    medium: [4, 5],
    hard: [5, 6],
  }[difficulty];

  const suspectCount = Number(
    body.suspectCount ??
      (difficulty === 'easy' ? 3 : difficulty === 'hard' ? 5 : 4)
  );

  if (!counts.includes(suspectCount)) {
    const error = new Error(
      `Choose ${counts.join(' or ')} suspects for ${difficulty} difficulty.`
    );
    error.status = 400;
    error.code = 'VALIDATION_ERROR';
    throw error;
  }

  const categories = [
    'theft',
    'murder_mystery',
    'missing_person',
    'cyber_mystery',
    'corporate_espionage',
    'general_mystery',
  ];

  const category = categories.includes(body.category)
    ? body.category
    : 'general_mystery';

  const evidenceComplexity = ['light', 'standard', 'complex'].includes(
    body.evidenceComplexity
  )
    ? body.evidenceComplexity
    : 'standard';

  return {
    scenario,
    difficulty,
    suspectCount,
    category,
    evidenceComplexity,
  };
}

export function validateGeneratedCase(data, config) {
  const fail = (message) => {
    const error = new Error(message);
    error.status = 502;
    error.code = 'AI_GENERATION_FAILED';
    throw error;
  };

  if (
    !data ||
    !nonEmpty(data.title) ||
    !data.incident ||
    !nonEmpty(data.incident.description) ||
    !nonEmpty(data.incident.location)
  ) {
    fail('The generated case was incomplete. Please try again.');
  }

  if (
    !Array.isArray(data.suspects) ||
    data.suspects.length !== config.suspectCount
  ) {
    fail('The generated case did not include the requested suspects. Please retry.');
  }

  if (
    !Array.isArray(data.evidence) ||
    data.evidence.length < 4 ||
    !Array.isArray(data.timeline) ||
    data.timeline.length < 3
  ) {
    fail('The generated case needs more evidence to be playable. Please retry.');
  }

  const suspectIds = new Set();

  for (const suspect of data.suspects) {
    if (
      !nonEmpty(suspect.id) ||
      suspectIds.has(suspect.id) ||
      !nonEmpty(suspect.name) ||
      !nonEmpty(suspect.occupation) ||
      !nonEmpty(suspect.background) ||
      !nonEmpty(suspect.alibi)
    ) {
      fail('A suspect profile was incomplete or duplicated. Please retry.');
    }

    suspectIds.add(suspect.id);
  }

  const evidenceIds = new Set();

  for (const item of data.evidence) {
    if (
      !nonEmpty(item.id) ||
      evidenceIds.has(item.id) ||
      !evidenceTypes.has(item.type) ||
      !nonEmpty(item.title) ||
      !nonEmpty(item.description) ||
      !Array.isArray(item.relatedSuspectIds)
    ) {
      fail('An evidence item was incomplete or duplicated. Please retry.');
    }

    if (item.relatedSuspectIds.some((id) => !suspectIds.has(id))) {
      fail('The case contains an invalid suspect reference. Please retry.');
    }

    if (
      !item.content ||
      typeof item.content !== 'object' ||
      Array.isArray(item.content)
    ) {
      fail(`Evidence "${item.title}" is missing its content.`);
    }

    if (item.type === 'document') {
      if (
        !nonEmpty(item.content.documentTitle) ||
        !Array.isArray(item.content.lines) ||
        item.content.lines.length === 0 ||
        !item.content.lines.every(nonEmpty)
      ) {
        fail(
          `Document evidence "${item.title}" is missing its title or text lines. Please generate the case again.`
        );
      }
    }

    evidenceIds.add(item.id);
  }

  const timelineIds = new Set(data.timeline.map((item) => item.id));

  if (
    timelineIds.size !== data.timeline.length ||
    data.timeline.some(
      (item) =>
        !nonEmpty(item.id) ||
        !nonEmpty(item.description) ||
        !item.timestamp ||
        Number.isNaN(Date.parse(item.timestamp))
    )
  ) {
    fail('The case timeline was incomplete. Please retry.');
  }

  for (const item of data.evidence) {
    if (
      (item.timelineReferenceIds || []).some(
        (id) => !timelineIds.has(id)
      )
    ) {
      fail('An evidence item refers to a missing timeline event. Please retry.');
    }
  }

  for (const item of data.timeline) {
    if (
      (item.relatedSuspectIds || []).some((id) => !suspectIds.has(id)) ||
      (item.relatedEvidenceIds || []).some((id) => !evidenceIds.has(id))
    ) {
      fail('A timeline entry refers to missing case information. Please retry.');
    }
  }

  if (
    !data.solution ||
    !suspectIds.has(data.solution.culpritSuspectId) ||
    !nonEmpty(data.solution.motive) ||
    !nonEmpty(data.solution.explanation)
  ) {
    fail('The generated solution was incomplete. Please retry.');
  }

  return {
    ...data,
    category: config.category,
    difficulty: config.difficulty,
  };
}

