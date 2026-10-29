import { randomUUID } from 'node:crypto';
import { generateWithGemini } from '../ai/geminiClient.js';
import { validateGeneratedCase } from './caseValidationService.js';

function mockCase(config) {
  const ids = Array.from(
    { length: config.suspectCount },
    (_, i) => `suspect-${i + 1}`
  );

  // Read suspect names from the user's scenario when possible.
  const scenarioText = String(config.scenario || '').trim();

  const boldNames = [
    ...scenarioText.matchAll(
      /\*\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\*\*/g
    ),
  ].map((match) => match[1]);

  const numberedNames = [
    ...scenarioText.matchAll(
      /\d+\.\s+\*?\*?([A-Z][a-z]+)\*?\*?\s*,/g
    ),
  ].map((match) => match[1]);

  const scenarioNames = [
    ...new Set([...boldNames, ...numberedNames]),
  ];

  const defaultNames = [
    'Mara Voss',
    'Elias Reed',
    'June Park',
    'Theo Bell',
    'Nadia Cole',
    'Silas Ward',
  ];

  const names = Array.from(
    { length: config.suspectCount },
    (_, i) =>
      scenarioNames[i] ||
      defaultNames[i] ||
      `Suspect ${i + 1}`
  );

  const culpritIndex = Math.floor(
    Math.random() * config.suspectCount
  );

  const base = Date.now() - 3600000;

  const iso = (minutes) =>
    new Date(base + minutes * 60000).toISOString();

  const suspects = names.map((name, i) => ({
    id: ids[i],
    name,
    age: 29 + i * 4,

    occupation: [
      'Curator',
      'Night guard',
      'Restoration artist',
      'Collector',
      'Archivist',
      'Courier',
    ][i],

    relationship: [
      'Managed the final exhibition preparations',
      'Was responsible for securing the east wing',
      'Restored the item shortly before it vanished',
      'Had made an offer for the collection',
      'Catalogued the gallery inventory',
      'Delivered the evening shipment',
    ][i],

    background: `A fictional ${
      [
        'curator',
        'security guard',
        'artist',
        'collector',
        'archivist',
        'courier',
      ][i]
    } with a connection to the gallery.`,

    motive:
      i === culpritIndex
        ? 'A private financial pressure tied to the collection.'
        : [
            'Wanted the gallery to succeed',
            'Was protecting a colleague',
            'Had access to the building',
          ][i % 3],

    alibi:
      i === culpritIndex
        ? 'Says they left through the east entrance before closing.'
        : `Says they were ${
            [
              'in the office',
              'checking the loading bay',
              'speaking with a guest',
              'near the front entrance',
            ][i % 4]
          } at the time.`,
  }));

  const culprit = suspects[culpritIndex];

  const timeline = [
    {
      id: 'event-1',
      timestamp: iso(-34),
      description: 'The last visitors leave the gallery.',
      relatedSuspectIds: [],
      relatedEvidenceIds: [],
    },
    {
      id: 'event-2',
      timestamp: iso(-22),
      description:
        'The east wing motion sensor records a brief interruption.',
      relatedSuspectIds: [ids[1 % ids.length]],
      relatedEvidenceIds: ['evidence-2'],
    },
    {
      id: 'event-3',
      timestamp: iso(-12),
      description:
        'A staff message mentions the service corridor.',
      relatedSuspectIds: [
        culprit.id,
        ids[(culpritIndex + 1) % ids.length],
      ],
      relatedEvidenceIds: ['evidence-1'],
    },
    {
      id: 'event-4',
      timestamp: iso(0),
      description:
        'The missing object is discovered during the closing check.',
      relatedSuspectIds: [ids[0]],
      relatedEvidenceIds: ['evidence-3'],
    },
    {
      id: 'event-5',
      timestamp: iso(18),
      description:
        'A witness reports seeing a light near the delivery entrance.',
      relatedSuspectIds: [ids[2 % ids.length]],
      relatedEvidenceIds: ['evidence-4'],
    },
  ];

  const evidence = [
    {
      id: 'evidence-1',
      type: 'chat',
      title: 'A message after closing',
      description:
        'A fictional staff exchange recovered from the shared case archive.',

      content: {
        participants: [
          culprit.name,
          suspects[(culpritIndex + 1) % names.length].name,
        ],

        messages: [
          {
            sender:
              suspects[(culpritIndex + 1) % names.length].name,
            text:
              'The east corridor was meant to stay locked tonight.',
            timestamp: iso(-13),
          },
          {
            sender: culprit.name,
            text:
              'I know. I only needed the service door for a minute.',
            timestamp: iso(-12),
          },
          {
            sender:
              suspects[(culpritIndex + 1) % names.length].name,
            text:
              'You said you had already gone home.',
            timestamp: iso(-11),
          },
        ],
      },

      relatedSuspectIds: [
        culprit.id,
        ids[(culpritIndex + 1) % ids.length],
      ],

      timelineReferenceIds: ['event-3'],
    },

    {
      id: 'evidence-2',
      type: 'cctv',
      title: 'East wing camera log',
      description:
        'A simulated still frame and observation from the east wing camera.',

      content: {
        timestamp: iso(-22),
        observations:
          'The corridor appears empty, but the service door indicator changes from secured to open for less than a minute.',
      },

      relatedSuspectIds: [ids[1 % ids.length]],
      timelineReferenceIds: ['event-2'],
    },

    {
      id: 'evidence-3',
      type: 'image',
      title: 'The empty display mount',
      description:
        'An illustrative scene diagram of the gallery display after closing.',

      content: {
        altText:
          'Illustrative fictional gallery scene diagram',

        visualClue:
          'Dust on the lower edge is disturbed, suggesting the frame was lifted rather than pulled straight forward.',
      },

      relatedSuspectIds: [ids[0]],
      timelineReferenceIds: ['event-4'],
    },

    {
      id: 'evidence-4',
      type: 'witness_statement',
      title: 'The delivery driver’s account',
      description:
        'A fictional witness statement recorded the morning after the incident.',

      content: {
        witnessName: 'R. Hale · delivery driver',

        statement:
          'I saw someone at the service entrance. They were carrying a long, flat parcel, but it looked too light to be the display frame.',
      },

      relatedSuspectIds: [ids[2 % ids.length]],
      timelineReferenceIds: ['event-5'],
    },

    {
      id: 'evidence-5',
      type: 'document',
      title: 'Closing checklist',
      description:
        'A fictional copy of the gallery’s signed closing checklist.',

      content: {
        documentTitle: 'North Wing · Closing Checklist',

        lines: [
          '9:02 PM — East wing secured',
          '9:17 PM — Motion sensor reset manually',
          '9:42 PM — Service door latch checked',
          `Signed: ${
            suspects[(culpritIndex + 1) % names.length].name
          }`,
        ],
      },

      relatedSuspectIds: [
        ids[(culpritIndex + 1) % ids.length],
      ],

      timelineReferenceIds: ['event-1', 'event-2'],
    },

    {
      id: 'evidence-6',
      type: 'physical',
      title: 'Fibers near the loading bay',
      description:
        'A fictional evidence note describing a trace found beside the delivery entrance.',

      content: {
        observation:
          'Dark blue wool fibers were caught on the inner latch. The gallery uniform includes a blue wool overshirt issued to evening staff.',
      },

      relatedSuspectIds: [
        ids[1 % ids.length],
        culprit.id,
      ],

      timelineReferenceIds: ['event-5'],
    },
  ];

  return {
    title: (() => {
      const text = scenarioText.toLowerCase();

      const namedObject = scenarioText.match(
        /(?:called|named)\s+(?:the\s+)?([A-Z][A-Za-z0-9]*(?:\s+[A-Z][A-Za-z0-9]*){0,4})/
      );

      if (text.includes('blue star')) {
        return 'The Mystery of the Blue Star Diamond';
      }

      if (text.includes('missing person')) {
        return 'The Missing Person Case';
      }

      if (text.includes('murder')) {
        return 'The Murder Mystery';
      }

      if (text.includes('cyber')) {
        return 'The Cyber Mystery';
      }

      if (
        text.includes('theft') ||
        text.includes('stolen') ||
        text.includes('disappeared')
      ) {
        return namedObject
          ? `The Mystery of ${namedObject[1]}`
          : 'The Case of the Missing Item';
      }

      return 'The Mystery You Submitted';
    })(),

    incident: {
      description:
        `A valuable gallery piece disappeared after hours. ` +
        `The staff each have a different account of the closing. ` +
        `${config.scenario}`,

      location:
        /(?:at|inside|in)\s+the\s+([A-Z][A-Za-z]+(?:\s+[A-Z][A-Za-z]+){0,3})/.exec(
          scenarioText
        )?.[1] || 'Unspecified fictional location',

      incidentTime: iso(0),
    },

    suspects,
    evidence,
    timeline,

    solution: {
      culpritSuspectId: culprit.id,

      motive:
        `${culprit.name} planned to sell the missing piece privately to cover a debt.`,

      explanation:
        `${culprit.name} is the only suspect whose account conflicts with the recovered staff messages. ` +
        'They claimed to have left before the east corridor was used, but the exchange shows they requested access to the service door after closing. ' +
        'The disturbed display mount and fibers at the loading bay match the route described in the witness account.',

      evidenceReasoning: [
        {
          title: 'The staff message',
          reasoning:
            'It places the culprit at the service corridor after their claimed departure.',
        },
        {
          title: 'The display mount',
          reasoning:
            'The direction of the marks suggests a deliberate, careful removal.',
        },
        {
          title: 'The loading bay fibers',
          reasoning:
            'They connect the service entrance to an evening staff uniform.',
        },
      ],

      misleadingClues: [
        {
          description:
            'The camera log points toward the night guard.',

          explanation:
            'The sensor reset was part of the regular closing procedure, and the log does not show the guard entering the gallery.',
        },
      ],

      reconstruction: timeline.map((event) => ({
        timestamp: event.timestamp,
        description: event.description,
      })),
    },
  };
}

export async function generateCase(config) {
  let data = null;
  let provider = 'mock';

  // Try Gemini first if an API key is configured.
  if (process.env.GEMINI_API_KEY) {
    try {
      data = await generateWithGemini(config);

      if (data) {
        provider = 'gemini';
      }
    } catch (error) {
      console.error(
        'Gemini generation failed:',
        error.message
      );

      console.warn(
        'Gemini is unavailable. Switching to the built-in mystery generator.'
      );
    }
  }

  // Use the built-in generator if Gemini fails.
  if (!data) {
    console.log(
      'Generating a case using the built-in mystery generator.'
    );

    data = mockCase(config);
    provider = 'mock';
  }

  // Validate the generated case.
  try {
    const validatedCase = validateGeneratedCase(
      data,
      config
    );

    return {
      ...validatedCase,
      provider,
    };
  } catch (error) {
    console.error(
      `${provider} case validation failed:`,
      error.message
    );

    // If Gemini data is invalid, try the built-in generator.
    if (provider === 'gemini') {
      console.warn(
        'Gemini case is invalid. Trying the built-in generator.'
      );

      const fallbackCase = mockCase(config);

      const validatedFallback = validateGeneratedCase(
        fallbackCase,
        config
      );

      return {
        ...validatedFallback,
        provider: 'mock',
      };
    }

    throw error;
  }
}

export function newCaseRecord(
  config,
  generated,
  ownerSessionId
) {
  return {
    caseCode: `MR-${randomUUID().slice(0, 6).toUpperCase()}`,

    ownerSessionId,

    title: generated.title,
    scenario: config.scenario,
    category: config.category,
    difficulty: config.difficulty,

    status: 'active',

    incident: generated.incident,
    suspects: generated.suspects,
    evidence: generated.evidence,
    timeline: generated.timeline,

    examinedEvidenceIds: [],
    accusation: null,

    solution: generated.solution,

    generationMetadata: {
      provider: generated.provider,

      model:
        generated.provider === 'gemini'
          ? process.env.GEMINI_MODEL || 'gemini-3.6-flash'
          : 'deterministic-demo',

      promptVersion: '1.0.0',
      generatedAt: new Date(),
    },
  };
}