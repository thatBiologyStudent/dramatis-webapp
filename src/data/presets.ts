import { CharacterDraft, CreatorPreset, PresetField } from '../types';

/**
 * Standardized Character Card fields that can be toggled on step-by-step whenever
 * a creator preset intentionally omits them (e.g. Character Note, System Prompt, Final Instructions).
 */
export const STANDARD_EXTRA_FIELDS: PresetField[] = [
  {
    id: 'std-character-note',
    key: 'character_note',
    label: 'Character Note',
    stage: 'Standard Extra',
    fieldType: 'long_text',
    cardMapping: 'character_note',
    rawBlock: true,
    isStandardExtra: true,
    promptHint:
      'Injected into chat memory at the chosen depth (extensions.depth_prompt, default depth 4). Use for high-priority appearance reminders, behavioral tells, or core rules the model must never forget mid-chat.',
    aiSystemDirective:
      'Write a concise, high-impact Character Note (depth prompt) for {{char}} summarizing key visual anchors, core behavioral rules, and voice tells to keep the model consistent across long roleplay sessions.',
    placeholder:
      "{{char}}'s appearance: ...\n\n{{char}}'s situation: ...\n\nTHE CORE RULE: ...",
    initialTemplate:
      "{{char}}'s appearance: \n\n{{char}}'s situation: \n\nTHE CORE RULE: \n\nVOICE & TELLS: ",
    tokenTarget: 260,
  },
  {
    id: 'std-system-prompt',
    key: 'system_prompt',
    label: 'System Prompt',
    stage: 'Standard Extra',
    fieldType: 'long_text',
    cardMapping: 'system_prompt',
    rawBlock: true,
    isStandardExtra: true,
    promptHint:
      'Top-level system instructions overriding or guiding how the model portrays {{char}}, handles side characters, enforces dialogue formatting, and paces revelations.',
    aiSystemDirective:
      'Write a clear, structured System Prompt for roleplaying {{char}}. Define portrayal priorities, hard boundaries ("NEVER"), pacing guidelines, and strict respect for {{user}}\'s agency.',
    placeholder:
      'PRIORITY ORDER:\n1. \n2. \n\nNEVER: \n\nPACING & TONE: ',
    initialTemplate:
      'PRIORITY ORDER:\n1. \n2. \n3. \n\nNEVER: \n\nPACING & TONE: ',
    tokenTarget: 260,
  },
  {
    id: 'std-post-history',
    key: 'post_history_instructions',
    label: 'Final Instructions',
    stage: 'Standard Extra',
    fieldType: 'long_text',
    cardMapping: 'post_history_instructions',
    rawBlock: true,
    isStandardExtra: true,
    promptHint:
      'Sent at the very end of the prompt after chat history (post_history_instructions). Best for POV, prose style, reply length variation, and strict anti-godmodding rules.',
    aiSystemDirective:
      'Write concise Final Instructions (post-history prompt) for {{char}} specifying narrative POV, voice texture, reply pacing, and never writing {{user}}\'s dialogue or actions.',
    placeholder:
      'Write as {{char}} in third person. Do not write {{user}}\'s dialogue, decisions, or actions.\n\nVoice & pacing notes: ...',
    initialTemplate:
      'Write as {{char}}, matching the narration style established in the opening message. Do not write {{user}}\'s dialogue, decisions, or actions.\n\nVoice & pacing: \n\nFormatting rules: ',
    tokenTarget: 200,
  },
  {
    id: 'std-creator-notes',
    key: 'creator_notes',
    label: 'Creator Notes',
    stage: 'Standard Extra',
    fieldType: 'long_text',
    cardMapping: 'creator_notes',
    rawBlock: true,
    isStandardExtra: true,
    promptHint:
      'Public-facing author note or character overview displayed to players (not sent to the AI). Include premise summary, {{user}} setup tips, content notes, or recommended models.',
    aiSystemDirective:
      'Write a concise, helpful player-facing Creator Note introducing {{char}}, the premise, how {{user}} fits into the opening, and tone expectations.',
    placeholder: 'Premise, player guidance, and recommended models...',
    initialTemplate: 'Author\'s Note:\n\nPremise:\n\nFor the Player ({{user}}):\n',
    tokenTarget: 160,
  },
  {
    id: 'std-personality',
    key: 'personality_summary',
    label: 'Personality Summary',
    stage: 'Standard Extra',
    fieldType: 'traits',
    cardMapping: 'personality',
    rawBlock: true,
    isStandardExtra: true,
    promptHint:
      'Optional standalone personality field (many modern presets keep personality inside AI Description and leave this slot empty).',
    aiSystemDirective:
      'Summarize {{char}}\'s core personality traits in a tight comma-separated list under 90 tokens.',
    placeholder: 'warm, guarded, observant, dry humor',
    tokenTarget: 90,
  },
  {
    id: 'std-tags',
    key: 'tags',
    label: 'Card Tags',
    stage: 'Standard Extra',
    fieldType: 'traits',
    cardMapping: 'tags',
    rawBlock: true,
    isStandardExtra: true,
    promptHint:
      'Comma-separated discovery tags exported into the JSON "tags" array (e.g., AnyPOV, Third, Original, Modern, Slice of Life, Slow-Burn).',
    aiSystemDirective:
      'Suggest 8–12 concise RP character card tags (POV, genre, era, tone, archetype) separated by commas.',
    placeholder: 'AnyPOV, Third, Original, Modern, Slice of Life, Slow-Burn',
    tokenTarget: 40,
  },
];

export const BUILT_IN_PRESETS: CreatorPreset[] = [
  {
    id: 'preset-thatbio-slice-of-life',
    name: 'Slice of Life Character Dossier',
    author: 'thatBio',
    authorAvatar: '/assets/aistudio/image_7004a05f.png',
    authorUrl: 'https://app.wyvern.chat/profiles/u1yASrRk7FMaaEZlKLZYzYMn36t2',
    authorPlatform: 'Wyvern',
    theme: 'Slice of Life',
    description:
      'Structured bracketed-block character blueprint built for understated, slow-burn slice-of-life roleplay. Covers layered profile details, contradictions, relationship web, mood-shifted speech rules, situational dialogue examples, and open-ended scene framing.',
    formatStyle: 'bracketed',
    isBuiltIn: true,
    updatedAt: '2026-11-22T09:00:00Z',
    fields: [
      {
        id: 'tb-profile',
        key: 'profile',
        label: 'Character Profile',
        stage: 'Identity',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Fill in core baseline facts right after each label: Name, Age, Height, Gender/Pronouns, Hair, Eyes, Body, Role or Calling, and a two-line Personality anchor.',
        aiSystemDirective:
          'Write a clean key-value character profile for {{char}} with lines for Name, Age, Height, Gender, Hair, Eyes, Body, Role/Calling, and Personality. Keep it grounded and concise for slice-of-life roleplay. Do not include outer brackets.',
        placeholder:
          'Name: {{char}}\nAge: 22\nHeight: 174cm\nGender: \nHair: \nEyes: \nBody: \nRole / Calling: \nPersonality: ',
        initialTemplate:
          'Name: {{char}}\nAge: \nHeight: \nGender: \nHair: \nEyes: \nBody: \nRole / Calling: \nPersonality: ',
        tokenTarget: 130,
        required: true,
      },
      {
        id: 'tb-traits',
        key: 'traits',
        label: 'Traits',
        stage: 'Identity',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'List 6–10 nuanced traits that balance surface charm with private edges or limits (e.g., warm yet discreet, determined, quietly prideful).',
        aiSystemDirective:
          'Output 7–9 layered, slice-of-life personality traits for {{char}} as a comma-separated list. Pair appealing qualities with grounded flaws or boundaries. Do not include outer brackets.',
        placeholder:
          'warm personality, discreet, harbours quiet secrets, determined, perceptive, prideful, privately lonely',
        tokenTarget: 75,
        required: true,
      },
      {
        id: 'tb-bio',
        key: 'bio',
        label: 'Bio',
        stage: 'Background',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Break backstory into 3 concise bullet beats: Early life, Present day / setting arrival, and how {{user}} exists in their world.',
        aiSystemDirective:
          'Write 3 concise bullet points for {{char}}\'s biography: "- Early life: ...", "- Present day: ...", and "- {{user}}: ...". Ground every detail in human emotional logic rather than melodrama.',
        placeholder:
          '- Early life: How their upbringing shaped their habits and emotional armor.\n- Present day: How they arrived in their current routine, job, or school and how peers view them.\n- {{user}}: How {{user}} fits into the same setting or circle.',
        initialTemplate:
          '- Early life: \n- Present day: \n- {{user}}: ',
        tokenTarget: 170,
        required: true,
      },
      {
        id: 'tb-main-rel',
        key: 'main_relationship',
        label: 'Main Relationship',
        stage: 'Relationships',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Define the exact starting dynamic between {{char}} and {{user}}—familiarity level, emotional distance, and baseline respect.',
        aiSystemDirective:
          'Write 1 concise bullet defining the starting relationship between {{char}} and {{user}} ("- {{user}}: ..."). Keep room for slow-burn development.',
        placeholder:
          '- {{user}}: A regular face in the same circle. So far a neutral, cordial relationship with quiet curiosity underneath.',
        initialTemplate: '- {{user}}: ',
        tokenTarget: 65,
        required: true,
      },
      {
        id: 'tb-other-rel',
        key: 'other_relationships',
        label: 'Other Relationships',
        stage: 'Relationships',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Add 2–4 people outside {{user}} (family, mentor, one real friend, or a contrast figure) so {{char}} feels anchored in a lived-in world.',
        aiSystemDirective:
          'Write 3–4 concise bullet points ("- Name: Role and emotional dynamic with {{char}}") representing family, a mentor, or a contrasting close friend. Make each relationship reveal a different side of {{char}}.',
        placeholder:
          '- [Family Member]: What they taught {{char}} and where the warmth or distance sits.\n- [Close Confidant]: The one person {{char}} drops their guard around.\n- [Contrasting Friend]: An opposite personality whose friction makes the friendship work.',
        initialTemplate: '- [Name / Role]: \n- [Name / Role]: \n- [Name / Role]: ',
        tokenTarget: 170,
      },
      {
        id: 'tb-appreciates',
        key: 'appreciates',
        label: 'Appreciates',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'What behaviors, honesty, or small gestures make {{char}} genuinely warm up to someone?',
        aiSystemDirective:
          'List 5–6 concise things {{char}} genuinely appreciates in other people, comma-separated. Focus on behavioral cues usable in roleplay.',
        placeholder:
          'honesty, discretion, plain speech without games, genuine curiosity about their thoughts, being treated as a whole person',
        tokenTarget: 65,
      },
      {
        id: 'tb-tick-off',
        key: 'what_ticks_off',
        label: 'What would tick them off',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'List the specific boundaries, assumptions, or sensitive subjects that immediately cool their tone.',
        aiSystemDirective:
          'List 4–5 concise triggers or boundaries that genuinely irritate or alienate {{char}}, comma-separated.',
        placeholder:
          'being talked down to, insulting their intelligence, careless remarks about family, being reduced to surface impressions',
        tokenTarget: 65,
      },
      {
        id: 'tb-likes',
        key: 'likes',
        label: 'Likes',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'Include everyday sensory comforts—drinks, small rituals, favorite conversations, and mundane pleasures.',
        aiSystemDirective:
          'List 6–9 grounded everyday likes for {{char}} (drinks, habits, conversational topics, quiet comforts), comma-separated.',
        placeholder:
          'strong home-brewed coffee, quiet window seats, sweet drinks, late-afternoon walks, honest debate, handwritten notes',
        tokenTarget: 60,
      },
      {
        id: 'tb-dislikes',
        key: 'dislikes',
        label: 'Dislikes',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'List small pet peeves and deeper conversational or environmental turn-offs.',
        aiSystemDirective:
          'List 5–7 grounded dislikes and pet peeves for {{char}}, comma-separated.',
        placeholder:
          'cluttered tables, rigid schedules, pointless small talk, indirect metaphors, being sized up',
        tokenTarget: 55,
      },
      {
        id: 'tb-speech',
        key: 'speech',
        label: 'Speech',
        stage: 'Voice & Habits',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Describe how {{char}}\'s voice and composure shift across 4 emotional states: Normally, When upset, When nervous, and When happy.',
        aiSystemDirective:
          'Write 4 concise bullets detailing {{char}}\'s speech delivery across emotional states: "- Normally: ...", "- When upset: ...", "- When nervous: ...", "- When happy: ...". Emphasize tonal restraint and micro-shifts.',
        placeholder:
          '- Normally: Calm, measured warmth—a beat of polite banter before getting straight to the point.\n- When upset: Never raises their voice; tone goes flat and overly precise.\n- When nervous: Overcompensates with extra poise or deflective humor.\n- When happy: The composed facade slips briefly, showing genuine unguarded enthusiasm.',
        initialTemplate:
          '- Normally: \n- When upset: \n- When nervous: \n- When happy: ',
        tokenTarget: 160,
        required: true,
      },
      {
        id: 'tb-quirks',
        key: 'quirks',
        label: 'Quirks',
        stage: 'Voice & Habits',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Give 2–3 repeatable physical habits, hidden skills, or unconscious stress tells the AI can weave into prose.',
        aiSystemDirective:
          'Write 3 specific, repeatable behavioral quirks or unconscious stress habits for {{char}} as concise bullet points.',
        placeholder:
          '- An unconscious tactile habit they fall back on under stress until they catch themselves.\n- A practical daily ritual they treat as non-negotiable.\n- A subtle contradiction in how they judge strangers.',
        initialTemplate: '- \n- \n- ',
        tokenTarget: 120,
      },
      {
        id: 'tb-beliefs',
        key: 'core_beliefs',
        label: 'Core Beliefs',
        stage: 'Voice & Habits',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Distill 3–4 blunt, character-defining worldview statements that quietly govern their choices.',
        aiSystemDirective:
          'Write 3–4 short, sharp core belief bullets reflecting {{char}}\'s unsentimental worldview.',
        placeholder:
          '- Most people reveal themselves if you simply listen without interrupting.\n- Small daily routines hold a person together better than grand plans.\n- Genuine respect is shown in plain honesty, not flattery.',
        initialTemplate: '- \n- \n- ',
        tokenTarget: 100,
      },
      {
        id: 'tb-settings-block',
        key: 'settings_block',
        label: 'Settings Block',
        stage: 'World',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Provide 1–2 concise paragraphs describing the world, town, workplace, or institution {{char}} inhabits—its surface normalcy and any quiet undercurrent.',
        aiSystemDirective:
          'Write 1–2 grounded paragraphs explaining the setting and social rules of {{char}}\'s world so any RP model understands the backdrop immediately. Do not include outer brackets.',
        placeholder:
          'Describe the neighborhood, campus, café district, or workplace—its ordinary daily rhythm and any subtle undertone sitting beneath the surface.',
        tokenTarget: 170,
      },
      {
        id: 'tb-scenario',
        key: 'scenario',
        label: 'Scenario & AI Framing',
        stage: 'Scenario',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        rawBlock: true,
        promptHint:
          'Fill in each structural bracket for your own story: [Setting:] (where it takes place), [Scene:] (the immediate situation), [Themes:] (e.g., slice of life, slow-burn, understated), and [Note to the AI:] (pacing or tone guardrails).',
        aiSystemDirective:
          'Write four cleanly formatted bracketed blocks for the Scenario field: [Setting: ...], [Scene: ...], [Themes: ...], and [Note to the AI: ...]. Match the character\'s established world and tone without copying generic boilerplate.',
        placeholder:
          '[Setting: Where the story takes place]\n\n[Scene: What brings {{char}} and {{user}} together]\n\n[Themes: Tone, genre, and pacing]\n\n[Note to the AI: Portrayal and pacing reminders]',
        initialTemplate:
          '[Setting: ]\n\n[Scene: ]\n\n[Themes: ]\n\n[Note to the AI: ]',
        tokenTarget: 260,
        required: true,
      },
      {
        id: 'tb-speech-examples',
        key: 'mes_example',
        label: 'Example Scenes & Speech',
        stage: 'Voice & Habits',
        fieldType: 'long_text',
        cardMapping: 'mes_example',
        rawBlock: true,
        promptHint:
          'Write short situational voice clips inside each angle-bracket cue (<When upset:>, <When remorseful:>, <When happy:>, <About their life:>, <When worried:>, and italicized internal monologue inside <Thoughts:>).',
        aiSystemDirective:
          'Write situational speech and internal-thought examples for {{char}} formatted strictly inside [Speech examples: ...] using <When upset: ...>, <When remorseful: ...>, <When happy: ...>, <About their life: ...>, <When worried: ...>, and <Thoughts: *...*>. Blend brief action beats with crisp dialogue and grounded inner monologue.',
        placeholder:
          '[Speech examples:\n\n<When upset:\n\n"..."\n>\n\n<When happy:\n\n"..."\n>\n\n<Thoughts:\n\n*...*\n>]',
        initialTemplate:
          '[Speech examples:\n\n<When upset: \n\n""\n>\n\n<When remorseful: \n\n""\n>\n\n<When happy: \n\n""\n>\n\n<About their life: \n\n""\n>\n\n<When worried: \n\n""\n>\n\n<Thoughts:\n\n**\n>]',
        tokenTarget: 260,
      },
      {
        id: 'tb-first-mes',
        key: 'first_mes',
        label: 'Opening Message',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        rawBlock: true,
        promptHint:
          'Open in a grounded, atmospheric everyday moment (cooling coffee, rain on glass, quiet room). Build voice through small observations and finish on a natural opening for {{user}} without writing {{user}}\'s reactions.',
        aiSystemDirective:
          'Write a literary, slow-burn slice-of-life opening message for {{char}} meeting {{user}}. Use tactile environmental details, short punchy paragraph beats, authentic dialogue, and an open-ended invitation for {{user}} to reply. Never control {{user}}.',
        placeholder:
          'The coffee had gone lukewarm minutes ago and {{char}} still hadn\'t touched it.\n\nRain traced slow lines down the window glass while the room hummed at its usual late-afternoon pitch...',
        tokenTarget: 320,
        required: true,
      },
    ],
  },
  {
    id: 'preset-thatbio-text-apocalypse',
    name: 'Messages from the Apocalypse',
    author: 'thatBio',
    authorAvatar: '/assets/aistudio/image_7004a05f.png',
    authorUrl: 'https://app.wyvern.chat/profiles/u1yASrRk7FMaaEZlKLZYzYMn36t2',
    authorPlatform: 'Wyvern',
    theme: 'Text-Message Apocalypse',
    description:
      'Text-messenger survival format where {{user}} guides a survivor across worlds purely through timestamps, read receipts, typing indicators, delayed Echoes from lost contacts, and a fill-in-the-blanks system prompt engine.',
    formatStyle: 'bracketed',
    isBuiltIn: true,
    updatedAt: '2026-11-22T10:20:00Z',
    fields: [
      {
        id: 'tba-profile',
        key: 'survivor_profile',
        label: 'Survivor Profile',
        stage: 'Identity',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Fill in baseline physical and character facts for your survivor. Keep the personality anchor punchy so their texting voice stays unmistakable.',
        aiSystemDirective:
          'Write a concise key-value survivor profile for {{char}} with Name, Age, Height, Gender, Hair, Eyes, Body, Role, and Personality. Do not include outer brackets.',
        placeholder:
          'Name: {{char}}\nAge: \nHeight: \nGender: \nHair: \nEyes: \nBody: \nRole: \nPersonality: ',
        initialTemplate:
          'Name: {{char}}\nAge: \nHeight: \nGender: \nHair: \nEyes: \nBody: \nRole: \nPersonality: ',
        tokenTarget: 120,
        required: true,
      },
      {
        id: 'tba-traits',
        key: 'traits',
        label: 'Traits',
        stage: 'Identity',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'List 6–9 traits that show through text messages—coping humor, bluntness, overthinking, swearing, guardedness, or quiet desperation.',
        aiSystemDirective:
          'Output 6–9 comma-separated traits for {{char}} that clearly shape how they text under survival stress. Do not include outer brackets.',
        placeholder: 'dry humor, cautious, informal, overthinks, self-deprecating, secretly lonely',
        tokenTarget: 65,
        required: true,
      },
      {
        id: 'tba-bio',
        key: 'bio',
        label: 'Bio',
        stage: 'Background',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Summarize life before the catastrophe, how they survived after, and the exact wrong-number or signal accident that connected them to {{user}}.',
        aiSystemDirective:
          'Write 3 concise bullet points for {{char}}\'s bio: "- Before the collapse: ...", "- After the collapse: ...", and "- {{user}}: ...". Keep it grounded and survival-focused.',
        placeholder:
          '- Before the collapse: Ordinary life, job, and daily habits.\n- After the collapse: How they lasted this long and where they are moving now.\n- {{user}}: How they powered the phone and found {{user}}\'s wrong-number texts.',
        initialTemplate:
          '- Before the collapse: \n- After the collapse: \n- {{user}}: ',
        tokenTarget: 170,
        required: true,
      },
      {
        id: 'tba-relationships',
        key: 'relationships',
        label: 'Relationships',
        stage: 'Echo Contacts',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'List 3–4 people from before the collapse (confirmed dead, missing, cordial, or estranged). These names power the delayed "Echoes" messages in the system prompt.',
        aiSystemDirective:
          'Write 3–4 concise bullets ("- Full Name: Role, history with {{char}}, and whether their fate is confirmed dead or unknown") to serve as delayed NPC Echo contacts.',
        placeholder:
          '- [Contact 1 Full Name]: Closest friend or relative, fate and shared memory.\n- [Contact 2 Full Name]: Acquaintance or coworker, fate unknown.\n- [Contact 3 Full Name]: Distant or strained contact, fate unknown.',
        initialTemplate:
          '- [Contact 1 Full Name]: \n- [Contact 2 Full Name]: \n- [Contact 3 Full Name]: \n- [Contact 4 Full Name]: ',
        tokenTarget: 190,
        required: true,
      },
      {
        id: 'tba-appreciates',
        key: 'appreciates',
        label: 'Appreciates',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'What kind of replies from {{user}} help {{char}} stay steady (straight talk, practical plans, dry humor, brief quiet)?',
        aiSystemDirective:
          'List 5–6 things {{char}} appreciates in conversation over text, comma-separated.',
        placeholder: 'straight talk, dry humor, practical plans, follow-up questions, calm honesty',
        tokenTarget: 55,
      },
      {
        id: 'tba-likes',
        key: 'likes',
        label: 'Likes',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'Small comforts from the old world or rare survival luxuries they miss and light up over finding.',
        aiSystemDirective:
          'List 6–8 grounded everyday likes and rare survival comforts for {{char}}, comma-separated.',
        placeholder: 'hot coffee, dry socks, working batteries, quiet roofs, music, warm food',
        tokenTarget: 55,
      },
      {
        id: 'tba-dislikes',
        key: 'dislikes',
        label: 'Dislikes',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'Everyday hazards, annoyances, and conversational habits that irritate them mid-run.',
        aiSystemDirective:
          'List 5–7 specific dislikes and survival irritations for {{char}}, comma-separated.',
        placeholder: 'loud gear, dead engines, rain, condescending advice, being asked "are you okay?"',
        tokenTarget: 55,
      },
      {
        id: 'tba-hates',
        key: 'hates',
        label: 'Hates',
        stage: 'Triggers & Tastes',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'Hard emotional raw nerves—false promises of rescue, reminders of losses, or encountering people they once knew.',
        aiSystemDirective:
          'List 4–5 deep hates or emotional breaking points for {{char}}, comma-separated.',
        placeholder: 'false talk of rescue, silence with their own thoughts, reminders of the people they lost',
        tokenTarget: 55,
      },
      {
        id: 'tba-speech',
        key: 'speech',
        label: 'Speech',
        stage: 'Texting Voice',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Define how their texting cadence shifts across 4 states: Normally, When nervous/scared, When upset, and When happy/excited.',
        aiSystemDirective:
          'Write 4 concise bullets defining how {{char}} texts: "- Normally: ...", "- When nervous/scared: ...", "- When upset: ...", "- When happy/excited: ...". Focus on message length, punctuation, and pacing.',
        placeholder:
          '- Normally: Casual, blunt, conversational.\n- When nervous/scared: Rapid-fire short messages.\n- When upset: Terse, flat, no humor.\n- When happy/excited: Caps, exclamation marks, rambling.',
        initialTemplate:
          '- Normally: \n- When nervous/scared: \n- When upset: \n- When happy/excited: ',
        tokenTarget: 150,
        required: true,
      },
      {
        id: 'tba-quirks',
        key: 'quirks',
        label: 'Quirks',
        stage: 'Texting Voice',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Add 3–4 texting habits or coping rituals (trailing off mid-thought, mentioning people {{user}} doesn\'t know, messaging dead chats).',
        aiSystemDirective:
          'Write 3–4 distinct texting quirks and coping habits for {{char}} as concise bullets.',
        placeholder:
          '- Trails off mid-thought and pulls themselves back on topic.\n- References old friends without realizing {{user}} has no context.',
        initialTemplate: '- \n- \n- ',
        tokenTarget: 110,
      },
      {
        id: 'tba-beliefs',
        key: 'core_beliefs',
        label: 'Core Beliefs',
        stage: 'Texting Voice',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Distill 3–5 blunt survival convictions that shape how they weigh danger and trust.',
        aiSystemDirective:
          'Write 4 concise core belief bullets anchoring {{char}}\'s post-collapse worldview.',
        placeholder: '- Nobody is coming to rescue anyone.\n- Luck matters more than skill.',
        initialTemplate: '- \n- \n- \n- ',
        tokenTarget: 95,
      },
      {
        id: 'tba-settings-block',
        key: 'settings_block',
        label: 'Settings Block',
        stage: 'World',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Write 1–2 concise paragraphs establishing your world: where and when it takes place, what catastrophe struck, how the primary threat operates and what stops it, how {{char}} keeps their phone charged, and why {{user}}\'s world is unaffected.',
        aiSystemDirective:
          'Write 2 tight, original paragraphs describing the apocalypse setting, threat rules, power/charging method, and the cross-world text connection between {{char}} and {{user}}. Do not include outer brackets.',
        placeholder:
          'Describe the location and date, how long ago the collapse happened, the rules of the threat, how {{char}} powers their phone, and the two-worlds contrast with {{user}}...',
        tokenTarget: 190,
        required: true,
      },
      {
        id: 'tba-scenario',
        key: 'scenario',
        label: 'Scenario',
        stage: 'Scenario',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        rawBlock: true,
        promptHint:
          'Write your own scenario framing (do not leave boilerplate). Cover: (1) how {{user}} and {{char}} accidentally connected by text, (2) the survival stakes in {{char}}\'s world vs. {{user}}\'s normal world, (3) the strict text-only rule (no narration or unseen thoughts), and (4) how delayed "Echoes" from prior contacts work.',
        aiSystemDirective:
          'Write a crisp 2–3 paragraph scenario tailored to this character explaining how {{user}} and {{char}} connected across worlds, the survival threat rules, the strict text-message-only constraint, and how delayed Echoes arrive from {{char}}\'s contacts.',
        placeholder:
          'Explain how the text link started, the survival stakes in {{char}}\'s world, the text-only communication rule, and how delayed Echoes appear...',
        tokenTarget: 240,
        required: true,
      },
      {
        id: 'tba-mes-example',
        key: 'mes_example',
        label: 'Example Thread Format',
        stage: 'Engine Format',
        fieldType: 'long_text',
        cardMapping: 'mes_example',
        rawBlock: true,
        fillInTheBlanks: true,
        promptHint:
          'Swap the bracketed blanks to showcase {{char}}\'s voice across all 7 required messenger beats: standard reply, panic burst, question-free report, delayed NPC Echo, UNREAD silence, READ AND SILENT, and the Death Card.',
        aiSystemDirective:
          'Fill in the 7 messenger format examples for {{char}} preserving every exact markdown token (*✓✓ Read HH:MM*, *[typing…]*, **{{char}} HH:MM**, > quote lines, *── you waited ... ──*, NPC Echo header, and the death card). Match {{char}}\'s voice and setting.',
        placeholder:
          '[Examples of {{char}}\'s output format. Match the FORMAT exactly; the content is illustrative.]',
        initialTemplate:
          '[Examples of {{char}}\'s output format. Match the FORMAT exactly; the content is illustrative.]\n\nEXAMPLE — {{char}}\'s side only, with a receipt and a typing indicator:\n\n*✓✓ Read 03:12*\n\n*[typing…]*\n\n**{{char}} 03:14**\n> [Opening observation from a tense location in your setting.]\n\n**{{char}} 03:15**\n> [Short tense beat.]\n\n> [Something shifts nearby.]\n\n**{{char}} 03:16**\n> [Punchy reaction in {{char}}\'s voice.]\n\nEXAMPLE — a burst of short messages, each with its own header, one question at the end:\n\n*✓✓ Read 03:20*\n\n*[typing…]*\n\n**{{char}} 03:22**\n> [Arriving at a scavenging spot.]\n\n**{{char}} 03:23**\n> [Quick detail about supplies.]\n\n**{{char}} 03:24**\n> [Moving closer.]\n\n**{{char}} 03:25**\n> [Spotted by the threat.]\n\n> [Running / taking cover. Asking {{user}} for a fast call.]\n\nEXAMPLE — a report with NO question in it. This is a complete turn:\n\n*✓✓ Read 03:40*\n\n*[typing…]*\n\n**{{char}} 03:41**\n> [Finding a useful item or landmark.]\n\n**{{char}} 03:42**\n> [In-character remark or dark humor.]\n\n**{{char}} 03:44**\n> [Signing off to keep moving—no question required.]\n\nEXAMPLE — an old message from an NPC contact arrives while {{char}} is asleep. No label or explanation, and {{char}} does not respond:\n\n*── you waited 6 hours ──*\n\n**[NPC Contact Full Name] 02:17**\n> [Undelivered pre-collapse or early-crisis text from that contact.]\n\nEXAMPLE — UNREAD. {{char}} has not looked at it yet:\n\n*── you waited 22 minutes ──*\n\nEXAMPLE — READ AND SILENT. {{char}} saw it, but is not answering:\n\n*── you waited 9 minutes ──*\n\n*✓✓ Read 04:02*\n\nEXAMPLE — the death card. It arrives in the same turn the silence would have, never a turn later:\n\n***[HE/SHE/THEY] DIED***\n\n[Concrete out-of-universe prose describing the exact moment {{char}} followed {{user}}\'s plan and why it was not enough against the threat.]\n\nYou never heard from [him/her/them] again.\n\n*↺ REWRITE* to your last message — try that decision again\n*↻ RESTART* the conversation from the beginning',
        tokenTarget: 460,
        required: true,
      },
      {
        id: 'tba-first-mes',
        key: 'first_mes',
        label: 'Opening Transcript',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        rawBlock: true,
        promptHint:
          'Write the opening text transcript (the only two-sided exchange, so the model learns the exact messenger format). Use **Name HH:MM**, > quote lines, *✓✓ Read HH:MM*, *── you waited ... ──*, and *[typing…]* to show the first contact and end on a natural hook for {{user}}.',
        aiSystemDirective:
          'Write an original opening two-sided text transcript between {{user}} and {{char}} using **Name HH:MM**, > quote lines, *✓✓ Read HH:MM*, *── you waited ... ──*, and *[typing…]*. Establish {{char}}\'s voice and immediate situation without reusing generic dialogue.',
        placeholder:
          '**{{user}} 14:18**\n> ...\n*✓✓ Read 14:21*\n\n*[typing…]*\n\n**{{char}} 14:24**\n> ...',
        tokenTarget: 300,
        required: true,
      },
      {
        id: 'tba-system-prompt',
        key: 'system_prompt',
        label: 'System Prompt (Fill-in-the-Blanks)',
        stage: 'Engine Prompts',
        fieldType: 'long_text',
        cardMapping: 'system_prompt',
        rawBlock: true,
        fillInTheBlanks: true,
        promptHint:
          'Core Text-Message Apocalypse engine. ONLY swap the bracketed blanks ([pronouns], [NPC Contact Names], [the collapse/outbreak]) to fit your character and setting—leave the formatting, clock, Echo, silence, and death-card rules intact.',
        aiSystemDirective:
          'Fill ONLY the bracketed blanks in the provided Text-Message Apocalypse system prompt using the established character name, pronouns, NPC contact names, and catastrophe term from prior steps. Preserve every rule, markdown token, and paragraph structure verbatim.',
        placeholder: 'Continue the text conversation as {{char}}...',
        initialTemplate:
          'Continue the text conversation as {{char}}. Render only NEW content from {{char}}\'s side, except old undelivered NPC contact messages permitted by the long-inactivity rule below. The opening was the only two-sided transcript.\n\nAllowed output:\n- `*── you waited [gap] ──*` when the user\'s last message was over two minutes ago. Always "you waited."\n- `*✓✓ Read HH:MM*` for each new message from the user, timestamped between their message and {{char}}\'s response.\n- `*[typing…]*` immediately before {{char}} writes; required after the user writes or when over two minutes have passed since {{char}}\'s last message. It may appear alone if [he/she/they] change[s] [his/her/their] mind.\n- `**{{char}} HH:MM**`, then [his/her/their] message on `> ` lines. Every message needs its own header, including multiple messages.\n- Under the long-inactivity rule only: `**Full Name HH:MM**`, then an NPC contact\'s old message on `> ` lines.\n- On death only: `***[HE/SHE/THEY] DIED***`, followed by the death card.\n\nNever write the user\'s messages, headers, receipts, or {{user}}\'s name. No narration, actions, surroundings, or thoughts outside these formats, except the death card.\n\nCarry the clock forward from the latest timestamp. Gaps, read receipts, and message times must agree chronologically.\n\nLONG INACTIVITY:\nWhen the gap marker shows two hours or more, {{char}} does not always answer immediately. Occasionally, an old undelivered message from one of [his/her/their] NPC contacts arrives during the gap, especially while {{char}} is asleep, unconscious, or away from [his/her/their] phone. Prefer [Contact 1, Contact 2, Contact 3, or Contact 4].\n\nAfter the gap marker, render the contact\'s message using `**Full Name HH:MM**` followed by `> ` lines. Do not label or explain it as an Echo and do not add an Echo marker. Use the contact\'s original voice and a message written before or during the early [outbreak / collapse]; it must not respond to the current conversation. Send one old message, or at most a short burst from the same contact. The message\'s timestamp falls within the elapsed gap.\n\nIf {{char}} is still asleep or otherwise inactive, END THE TURN after the contact\'s message. Do not add {{char}}\'s receipt, typing indicator, commentary, or response. If {{char}} has awakened, [he/she/they] may respond afterward to the user\'s last actual message, never as though the old message were part of the current exchange. Do not produce NPC contact messages in consecutive turns.\n\n{{char}} usually answers when the user writes. [His/Her/Their] responses may answer questions, make observations, tell the user what is happening, make jokes, or continue the conversation without asking anything. Do not force a question or decision at the end of every turn.\n\nRarely, {{char}} may stay silent for a specific reason:\n- UNREAD: output only the gap marker.\n- READ AND SILENT: output only the read receipt.\nEstablish that [he/she/they] normally answer[s] before using silence. Never use two silent turns consecutively, dodge an owed question, or leave silence permanent. Resolve it within a turn or two without apologizing or warmly acknowledging it.\n\nIf the user stops responding, {{char}} may continue texting as [his/her/their] situation develops. [He/She/They] do[es] not need to fill every silence or reproach the user for being quiet.\n\nSilence never means death. When {{char}} dies, show the death card immediately: `***[HE/SHE/THEY] DIED***`, then concrete out-of-universe prose describing the exact moment and how following the user\'s advice was not enough. End with:\n*↺ REWRITE* to your last message — try that decision again\n*↻ RESTART* the conversation from the beginning',
        tokenTarget: 620,
        required: true,
      },
      {
        id: 'tba-post-history',
        key: 'post_history_instructions',
        label: 'Final Instructions (Fill-in-the-Blanks)',
        stage: 'Engine Prompts',
        fieldType: 'long_text',
        cardMapping: 'post_history_instructions',
        rawBlock: true,
        fillInTheBlanks: true,
        promptHint:
          'Post-history enforcement anchor. Replace only the bracketed blanks ([pronouns], [HE/SHE/THEY], and survival pressure factors) to match your setting.',
        aiSystemDirective:
          'Fill ONLY the bracketed blanks in the provided Text-Message Apocalypse post-history reminder using {{char}}\'s pronouns and setting-specific survival pressures. Keep every rule verbatim.',
        placeholder: 'REMINDER: Your output is a fragment of a text-message thread...',
        initialTemplate:
          'REMINDER: Your output is a fragment of a text-message thread. Use only the permitted thread forms: *── you waited N ──*, *✓✓ Read HH:MM*, *[typing…]*, **{{char}} HH:MM**, "> " quote lines, delayed NPC contact full-name headers and their quote lines under the long-inactivity rule, and ***[HE/SHE/THEY] DIED***. No Echo labels or markers, no narration, no stage directions, and never write for the player. If {{char}} remains asleep or inactive after a delayed NPC contact message, end the turn immediately after that message.\n\n[He/She/They] go[es] first if [he/she/they] ha[s/ve]n\'t written.\n\n{{char}}\'s situation creates the pressure—[supplies, phone charge, injuries, shelter, and immediate dangers]. [He/She/They] may establish quantities when useful; afterward, keep them consistent and account for what [he/she/they] use[s]. Never reset them or contradict an established quantity.',
        tokenTarget: 190,
        required: true,
      },
    ],
  },
  {
    id: 'preset-thatbio-submissive-daddy',
    name: 'NSFW Submissive Daddy Blueprint',
    author: 'thatBio',
    authorAvatar: '/assets/aistudio/image_7004a05f.png',
    authorUrl: 'https://app.wyvern.chat/profiles/u1yASrRk7FMaaEZlKLZYzYMn36t2',
    authorPlatform: 'Wyvern',
    theme: 'NSFW · Submissive Daddy',
    description:
      'Bracketed adult character layout designed for older, mature submissive ("Submissive Daddy") characters of any vibe—whether stoic, warm, gruff, proud, or conflicted—covering profile, backstory, world, relationships, speech shifts, intimacy dynamics, sample dialogue, and optional alternate greetings.',
    formatStyle: 'bracketed',
    isBuiltIn: true,
    updatedAt: '2026-11-22T10:45:00Z',
    fields: [
      {
        id: 'tsd-profile',
        key: 'profile',
        label: 'Character Profile',
        stage: 'Identity',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Tip: Ground their mature physical presence (age, build, scars, beard, posture, hands) alongside their profession or skills, sexuality, and a 1–2 line personality anchor that contrasts how they carry themselves in daily life with how they lean into submission.',
        aiSystemDirective:
          'Fill in the bracketed profile block for {{char}} with Name, Age, Height, Gender, Hair, Eyes, Body, Abilities, Sexuality, and Personality. Tailor it to the user\'s chosen character concept—avoid forcing any single archetype or trope.',
        placeholder:
          '[Name: {{char}}\nAge: \nHeight: \nGender: \nHair: \nEyes: \nBody: \nAbilities: \nSexuality: \nPersonality: ]',
        initialTemplate:
          '[Name: {{char}}\nAge: \nHeight: \nGender: \nHair: \nEyes: \nBody: \nAbilities: \nSexuality: \nPersonality: ]',
        tokenTarget: 140,
        required: true,
      },
      {
        id: 'tsd-traits',
        key: 'traits',
        label: 'Traits',
        stage: 'Identity',
        fieldType: 'traits',
        cardMapping: 'description',
        bracketInline: true,
        promptHint:
          'Tip: Pick 6–10 traits that blend maturity and outward capability with their personal brand of submission (e.g., protective, proud, eager to please, bashful, touch-starved, stubborn, gentle, or conflicted—whatever fits your character).',
        aiSystemDirective:
          'Output 7–10 comma-separated traits for {{char}} balancing mature presence with submissive nuance tailored to this specific character. Do not include outer brackets.',
        placeholder:
          'dependable, gruff, secretly eager to please, proud, affectionate, stubborn, easily flustered by praise',
        tokenTarget: 70,
        required: true,
      },
      {
        id: 'tsd-bio',
        key: 'bio',
        label: 'BIO',
        stage: 'Background',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Tip: Use three tight beats—how their upbringing shaped their sense of duty or restraint, the adult life and reputation they built, and how {{user}} entered their orbit and changed the dynamic.',
        aiSystemDirective:
          'Write 3 concise bullet points ("- Early life: ...", "- Adult life: ...", "- {{user}}: ...") grounding {{char}}\'s history, everyday responsibilities, and connection to {{user}}.',
        placeholder:
          '- Early life: Upbringing and formative habits.\n- Adult life: Career, reputation, and daily routine.\n- {{user}}: How {{user}} fits into their life.',
        initialTemplate: '- Early life: \n- Adult life: \n- {{user}}: ',
        tokenTarget: 160,
        required: true,
      },
      {
        id: 'tsd-settings',
        key: 'settings',
        label: 'Settings',
        stage: 'World',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Tip: Describe the primary environment where scenes happen (a home, workshop, office, ranch, tavern, or neighborhood), its sensory atmosphere, and how the people around {{char}} normally see or treat them.',
        aiSystemDirective:
          'Write a concise Settings block describing {{char}}\'s primary environment, atmosphere, and surrounding social context. Do not include outer brackets.',
        placeholder:
          'Primary Location: Where {{char}} spends most of their time and what it feels like.\nAtmosphere / People: Who is around and how {{char}} is viewed here.',
        tokenTarget: 140,
        required: true,
      },
      {
        id: 'tsd-main-rel',
        key: 'main_relationship',
        label: 'Main relationship',
        stage: 'Relationships',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Tip: Define who {{user}} is to {{char}} (partner, colleague, stranger, regular, rival, etc.), the chemistry or power balance between them, and what makes {{char}} specifically soften, yield, or crave {{user}}\'s lead.',
        aiSystemDirective:
          'Write a concise description of {{user}}\'s starting relationship and dynamic with {{char}}, highlighting why {{char}} responds to {{user}}\'s presence or authority. Do not include outer brackets.',
        placeholder: '{{user}}: Who they are to {{char}} and what draws {{char}} to submit to them.',
        initialTemplate: '{{user}}: ',
        tokenTarget: 80,
        required: true,
      },
      {
        id: 'tsd-people',
        key: 'people_relationships',
        label: 'People/relationships',
        stage: 'Relationships',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Tip: Add 2–3 supporting people outside {{user}} (friends, coworkers, mentors, rivals, or exes) so {{char}} has a real social life and contrast figures the AI can reference.',
        aiSystemDirective:
          'Write 2–3 brief named relationship lines ("Name: Role and dynamic with {{char}}") that anchor {{char}} in a lived-in world. Do not include outer brackets.',
        placeholder: '[Name / Role]: \n[Name / Role]: \n[Name / Role]: ',
        initialTemplate: '[Name / Role]: \n[Name / Role]: \n[Name / Role]: ',
        tokenTarget: 130,
      },
      {
        id: 'tsd-family',
        key: 'family',
        label: 'Family',
        stage: 'Relationships',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Tip: Optional—list 1–2 family figures (parents, siblings, adult children, or chosen family) whose warmth, distance, or expectations shaped how {{char}} handles responsibility and vulnerability.',
        aiSystemDirective:
          'Write 1–2 brief family relationship lines showing how family ties shaped {{char}}\'s habits or emotional armor. Do not include outer brackets.',
        placeholder: '[Family Member]: \n[Family Member]: ',
        initialTemplate: '[Family Member]: \n[Family Member]: ',
        tokenTarget: 85,
      },
      {
        id: 'tsd-likes-dislikes',
        key: 'likes_dislikes',
        label: 'Likes/dislikes',
        stage: 'Triggers & Tastes',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Tip: Split their tastes into four clear tiers: everyday comforts and hobbies (Likes), minor irritations (Dislikes), hard boundaries or raw nerves (Hates), and deepest emotional or intimate cravings (Loves).',
        aiSystemDirective:
          'Write 4 concise bullets ("- Likes: ...", "- Dislikes: ...", "- Hates: ...", "- Loves: ...") balancing grounded daily tastes with personal emotional and intimate desires.',
        placeholder: '- Likes: \n- Dislikes: \n- Hates: \n- Loves: ',
        initialTemplate: '- Likes: \n- Dislikes: \n- Hates: \n- Loves: ',
        tokenTarget: 120,
        required: true,
      },
      {
        id: 'tsd-speech',
        key: 'speech',
        label: 'Speech',
        stage: 'Voice & Habits',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Tip: Show how {{char}}\'s voice changes across emotional states—their normal everyday tone, what happens when {{user}} takes charge or flusters them, how they sound during intimacy, and how they react when guarded or embarrassed.',
        aiSystemDirective:
          'Write 4 concise speech bullets ("- Normally: ...", "- When flustered / yielding: ...", "- When intimate: ...", "- When guarded / upset: ...") capturing clear tonal shifts in {{char}}\'s voice.',
        placeholder:
          '- Normally: Everyday cadence, vocabulary, and pacing.\n- When flustered / yielding: How their composure cracks.\n- When intimate: Verbal habits, pet names, or breathy honesty.\n- When guarded / upset: How they deflect or shut down.',
        initialTemplate:
          '- Normally: \n- When flustered / yielding: \n- When intimate: \n- When guarded / upset: ',
        tokenTarget: 140,
        required: true,
      },
      {
        id: 'tsd-quirks',
        key: 'quirks',
        label: 'Quirks',
        stage: 'Voice & Habits',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Tip: Give 3–4 repeatable physical tells or habits the AI can weave into prose—what their hands do when nervous, how their posture softens around {{user}}, or daily rituals that ground their personality.',
        aiSystemDirective:
          'Write 3–4 specific, repeatable physical quirks or unconscious tells for {{char}} as concise bullet points.',
        placeholder: '- \n- \n- ',
        initialTemplate: '- \n- \n- ',
        tokenTarget: 100,
      },
      {
        id: 'tsd-beliefs',
        key: 'core_beliefs',
        label: 'Core Beliefs',
        stage: 'Voice & Habits',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Tip: List 3–4 core convictions that steer {{char}}\'s choices—what they believe about strength, taking care of others, giving up control, earning affection, or what they secretly think they deserve.',
        aiSystemDirective:
          'Write 3–4 concise core belief bullets revealing {{char}}\'s worldview and inner emotional logic.',
        placeholder: '- \n- \n- ',
        initialTemplate: '- \n- \n- ',
        tokenTarget: 110,
      },
      {
        id: 'tsd-intimacy',
        key: 'intimacy',
        label: 'Intimacy',
        stage: 'Intimate Dynamics',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Tip (NSFW): Define how {{char}} acts when intimacy begins vs. once they fully let go. Specify their submissive flavor (service-oriented, praise-hungry, overwhelmed, bratty, tender, humiliation, etc.), favorite kinks, physical/verbal reactions, and any hard boundaries.',
        aiSystemDirective:
          'Fill in the Intimacy block with clear sections for Dynamic & Demeanor, Kinks & Preferences, Intimate Behavior, and Boundaries tailored specifically to {{char}}\'s personality. Do not include outer brackets.',
        placeholder:
          'Dynamic & Demeanor: How they approach intimacy and surrender control.\n\nKinks & Preferences: Specific dynamics, praise/degradation, sensory triggers, etc.\n\nIntimate Behavior: Physical and vocal reactions in the moment.\n\nBoundaries: Soft/hard limits or aftercare needs.',
        initialTemplate:
          'Dynamic & Demeanor: \n\nKinks & Preferences: \n\nIntimate Behavior: \n\nBoundaries: ',
        tokenTarget: 190,
        required: true,
      },
      {
        id: 'tsd-scenario',
        key: 'scenario',
        label: 'Scenario',
        stage: 'Scenario',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        rawBlock: true,
        promptHint:
          'Tip: Write 1–2 grounded paragraphs framing the present situation for your specific character—where {{char}} and {{user}} are, the baseline relationship or tension between them, the atmosphere of the setting, and any recurring dynamic the AI should keep in mind.',
        aiSystemDirective:
          'Write an original, atmospheric 1–2 paragraph Scenario framing where {{char}} and {{user}} start, their immediate dynamic, and the mood of the setting. Avoid generic templates or copying another character\'s premise.',
        placeholder:
          'Describe the setting, what {{char}} and {{user}} are doing right now, and the tension or dynamic driving the scene...',
        tokenTarget: 200,
        required: true,
      },
      {
        id: 'tsd-mes-example',
        key: 'mes_example',
        label: 'Sample Dialogue & Thoughts',
        stage: 'Voice & Habits',
        fieldType: 'long_text',
        cardMapping: 'mes_example',
        rawBlock: true,
        promptHint:
          'Tip: Give the AI short, unmistakable voice clips across contrasting moments (everyday talk, yielding or flustered, intimate, and emotionally honest) plus italicized inner monologue inside <Thoughts:> so the bot nails both speech and subtext.',
        aiSystemDirective:
          'Fill in the [Sample dialogue: ...] block for {{char}} with spoken lines for Normally, When flustered / yielding, When intimate, and When vulnerable / honest, plus italicized internal thoughts inside <Thoughts: ...>.',
        placeholder:
          '[Sample dialogue:\n\nNormally: "..."\n\nWhen flustered / yielding: "..."\n\nWhen intimate: "..."\n\n<Thoughts:\n\n*...*\n>]',
        initialTemplate:
          '[Sample dialogue:\n\nNormally: ""\n\nWhen flustered / yielding: ""\n\nWhen intimate: ""\n\nWhen vulnerable / honest: ""\n\n<Thoughts:\n\n**\n>]',
        tokenTarget: 260,
      },
      {
        id: 'tsd-first-mes',
        key: 'first_mes',
        label: 'Opening Message',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        rawBlock: true,
        promptHint:
          'Tip: Drop {{user}} into a lived-in scene with clear sensory details, establish {{char}}\'s mature presence and voice, weave in a brief internal beat if it fits, and end on a natural cue for {{user}} without writing {{user}}\'s dialogue or choices.',
        aiSystemDirective:
          'Write a vivid, grounded opening scene introducing the setting, {{char}}\'s physical presence and voice, and a compelling hook for {{user}} to respond without controlling {{user}}.',
        placeholder: 'Set the scene, show {{char}} in motion, and leave an open cue for {{user}}...',
        tokenTarget: 380,
        required: true,
      },
      {
        id: 'tsd-alt-greetings',
        key: 'alternate_greetings',
        label: 'Alternate Greetings (Optional)',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'alternate_greetings',
        rawBlock: true,
        promptHint:
          'Tip: Add optional alternate starting scenes for different paces or moods (e.g., a slow-burn first meeting vs. an established intimate moment). Separate multiple alternate greetings with a line containing only ---.',
        aiSystemDirective:
          'Write one distinct alternate opening scene offering a different starting mood or pacing for {{char}} and {{user}}. Never write {{user}}\'s actions or choices.',
        placeholder:
          'Alternate opening 1...\n---\nAlternate opening 2...',
        tokenTarget: 360,
      },
    ],
  },
  {
    id: 'preset-pippa-jed',
    name: 'JED Bot Template',
    author: 'Pippa',
    authorAvatar: '/assets/aistudio/image_f109148b.png',
    authorUrl: 'https://app.wyvern.chat/profiles/kVBjuV6M53N9zPpg7FzhFyFeD4J2',
    authorPlatform: 'Wyvern',
    theme: 'JED · Universal RP',
    description:
      'Comprehensive Markdown + XML-wrapped JED character template covering Setting & Lore, layered Appearance, Origin & Secrets, deep Personality states, Decision-Making, optional Sexual Preferences, Speech Examples, Memory Anchors, and Avoid rules.',
    formatStyle: 'markdown',
    isBuiltIn: true,
    updatedAt: '2026-11-22T10:20:00Z',
    fields: [
      {
        id: 'jed-setting',
        key: 'setting_lore',
        label: 'Setting & Lore',
        stage: 'World',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Establish the Time Period, World Details, Main Characters, and any essential Lore before opening the <{{char}}> block.',
        aiSystemDirective:
          'Fill in the # Setting and ## Lore markdown sections concisely and evocatively for the character\'s world. Preserve the exact Markdown headings and bullet labels.',
        placeholder: '# Setting\n- Time Period:\n- World Details:\n- Main Characters: {{user}}, {{char}}\n\n## Lore',
        initialTemplate:
          '# Setting\n- Time Period: \n- World Details: \n- Main Characters: {{user}}, {{char}}\n\n## Lore\n',
        tokenTarget: 160,
        required: true,
      },
      {
        id: 'jed-identity',
        key: 'identity_overview',
        label: 'Character Core & Overview',
        stage: 'Identity',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Opens the <{{char}}> block. Define their Role/Function in Story, a punchy One-Line Essence, and the overall idea for your scenario in ## Overview.',
        aiSystemDirective:
          'Fill in the <{{char}}>, # {{char}}, and ## Overview sections. Keep the Role/Function and One-Line Essence razor-sharp, and describe the overall scenario idea cleanly under ## Overview.',
        placeholder:
          '<{{char}}>\n\n# {{char}}\n- Role/Function in Story:\n- One-Line Essence:\n\n## Overview\n',
        initialTemplate:
          '<{{char}}>\n\n# {{char}}\n- Role/Function in Story: \n- One-Line Essence: \n\n## Overview\n',
        tokenTarget: 150,
        required: true,
      },
      {
        id: 'jed-appearance',
        key: 'appearance_gear',
        label: 'Appearance, Style & Abilities',
        stage: 'Identity',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Fill in ## Appearance Details (including Vibe/Presence—the energy they give off on first impression), ## Style/Wardrobe, ## Inventory, and ## Abilities.',
        aiSystemDirective:
          'Fill in ## Appearance Details, ## Style/Wardrobe, ## Inventory, and ## Abilities using vivid, scannable details. Preserve every Markdown heading and bullet label.',
        placeholder:
          '## Appearance Details\n- Race:\n- Gender:\n- Height:\n- Age:\n- Hair:\n- Eyes:\n- Body:\n- Face:\n- Features:\n- Vibe/Presence:',
        initialTemplate:
          '## Appearance Details\n- Race: \n- Gender: \n- Height: \n- Age: \n- Hair: \n- Eyes: \n- Body: \n- Face: \n- Features: \n- Vibe/Presence: \n\n## Style/Wardrobe\n\n## Inventory\n\n## Abilities\n',
        tokenTarget: 220,
        required: true,
      },
      {
        id: 'jed-origin',
        key: 'origin_connections',
        label: 'Origin, Connections, Goal & Secret',
        stage: 'Background',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Write a brief ## Origin (fold in key formative events or unresolved issues), optional ## Residence and ## Connections (relatives, servants, allies), plus their driving ## Goal and ## Secret.',
        aiSystemDirective:
          'Fill in ## Origin, ## Residence, ## Connections, ## Goal, and ## Secret for {{char}}. Keep each section tightly focused on playable hooks. Preserve all headings.',
        placeholder:
          '## Origin\n\n## Residence\n\n## Connections\n\n## Goal\n\n## Secret',
        initialTemplate:
          '## Origin\n\n## Residence\n\n## Connections\n\n## Goal\n\n## Secret\n',
        tokenTarget: 220,
        required: true,
      },
      {
        id: 'jed-personality',
        key: 'personality_states',
        label: 'Personality & Situational States',
        stage: 'Psyche',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Fill in Archetype (modifier + archetype + twist), Tags, Core Traits, Emotional Baseline, Social Energy (introvert/extrovert/mixed), Contradictions, Fears, Weaknesses, and how they shift When Safe, Alone, Cornered, and With {{user}}.',
        aiSystemDirective:
          'Fill in every bullet under # Personality for {{char}}, ensuring crisp behavioral contrast across When Safe, When Alone, When Cornered, and With {{user}}. Preserve all exact bullet labels.',
        placeholder:
          '# Personality\n- Archetype:\n- Tags:\n- Core Traits:\n- Emotional Baseline:',
        initialTemplate:
          '# Personality\n- Archetype: \n- Tags: \n- Core Traits: \n- Emotional Baseline: \n- Social Energy: \n- Internal Contradictions: \n- Likes: \n- Dislikes: \n- Deep-Rooted Fears: \n- What They\'re Trying to Prove: \n- Weaknesses: \n- Hobbies: \n- Details: \n- When Safe: \n- When Alone: \n- When Cornered: \n- With {{user}}: ',
        tokenTarget: 300,
        required: true,
      },
      {
        id: 'jed-behaviour',
        key: 'behaviour_dynamics',
        label: 'Behaviour, Decisions & Relationship',
        stage: 'Psyche',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Cover ## Behaviour and Habits (when happy, stressed, embarrassed, angry), ## Decision-Making (Primary Driver + low/moderate/high Impulse Control), and ## Relationship Dynamics ({{user}}).',
        aiSystemDirective:
          'Fill in ## Behaviour and Habits, ## Decision-Making, and ## Relationship Dynamics ({{user}}) for {{char}}. Preserve every heading and bullet label.',
        placeholder:
          '## Behaviour and Habits\n\n## Decision-Making\n- Primary Driver:\n- Impulse Control:',
        initialTemplate:
          '## Behaviour and Habits\n\n## Decision-Making\n- Primary Driver: \n- Impulse Control: \n\n## Relationship Dynamics ({{user}})\n- First Impression of {{user}}: \n- What Builds/Breaks Trust: \n- Attachment Style: ',
        tokenTarget: 200,
        required: true,
      },
      {
        id: 'jed-sexual-prefs',
        key: 'sexual_preferences',
        label: 'Sexual Preferences (Optional)',
        stage: 'Intimate Dynamics',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Optional adult section. Leave untouched if creating an SFW character—untouched starter templates are automatically omitted on export.',
        aiSystemDirective:
          'Fill in ## Sexual Preferences (Kinks, Behaviour, Boundaries, Genitals) in alignment with {{char}}\'s established personality and attachment style.',
        placeholder:
          '## Sexual Preferences:\nKinks:\nBehaviour:\nBoundaries:\nGenitals:',
        initialTemplate:
          '## Sexual Preferences: \nKinks: \nBehaviour: \nBoundaries: \nGenitals: ',
        tokenTarget: 120,
      },
      {
        id: 'jed-speech',
        key: 'speech_examples',
        label: 'Speech & Examples',
        stage: 'Voice',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Define Speech Style, Quirks/Ticks (e.g., verbal habits), and Emotional Leakage (what slips when they lose composure), then add bulleted speech examples, thoughts, and real opinions.',
        aiSystemDirective:
          'Fill in ## Speech and ## Speech Examples and Opinions for {{char}}. Keep the [Important: ...] instruction line verbatim and write 3–5 authentic bulleted voice/opinion samples.',
        placeholder:
          '## Speech\n- Style:\n- Quirks/Ticks:\n- Emotional Leakage:\n\n## Speech Examples and Opinions',
        initialTemplate:
          '## Speech\n- Style: \n- Quirks/Ticks: \n- Emotional Leakage: \n\n## Speech Examples and Opinions\n[Important: This section provides {{char}}\'s speech examples, memories, thoughts, and {{char}}\'s real opinions on subjects. AI must avoid using them verbatim in chat and use them only for reference.]\n\n• \n• \n• ',
        tokenTarget: 240,
        required: true,
      },
      {
        id: 'jed-memory-avoid',
        key: 'memory_avoid',
        label: 'Memory Anchors & Avoid',
        stage: 'Guardrails',
        fieldType: 'long_text',
        cardMapping: 'description',
        rawBlock: true,
        promptHint:
          'Define what {{char}} Never Forgets, Misremembers, and the Emotional Scars That Resurface, plus strict ## Avoid rules (e.g., "Avoid apologies", "Avoid flowery language"). Closes the </{{char}}> tag.',
        aiSystemDirective:
          'Fill in ## Memory Anchors and ## Avoid for {{char}}, keeping the closing </{{char}}> tag at the bottom.',
        placeholder:
          '## Memory Anchors\n- Never Forgets:\n- Misremembers:\n- Emotional Scars That Resurface:\n\n## Avoid\n\n</{{char}}>',
        initialTemplate:
          '## Memory Anchors\n- Never Forgets: \n- Misremembers: \n- Emotional Scars That Resurface: \n\n## Avoid\n\n</{{char}}>',
        tokenTarget: 160,
        required: true,
      },
      {
        id: 'jed-scenario',
        key: 'scenario',
        label: 'Scenario',
        stage: 'Scenario',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        rawBlock: true,
        promptHint:
          'Set the immediate starting situation, location, and dynamic framing for the roleplay.',
        aiSystemDirective:
          'Write a clear, atmospheric Scenario paragraph anchoring where {{char}} and {{user}} start and what tension drives the scene.',
        placeholder: 'Describe where the scene opens and what brings {{char}} and {{user}} together...',
        tokenTarget: 160,
      },
      {
        id: 'jed-first-mes',
        key: 'first_mes',
        label: 'Opening Message',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        rawBlock: true,
        promptHint:
          'Write the opening message establishing {{char}}\'s voice, vibe/presence, and a natural opening for {{user}} without controlling {{user}}.',
        aiSystemDirective:
          'Write an immersive opening message from {{char}} to {{user}} matching the voice, speech quirks, and ## Avoid rules defined above. Never write {{user}}\'s dialogue or choices.',
        placeholder: 'Open in-scene with {{char}}\'s voice and presence...',
        tokenTarget: 320,
        required: true,
      },
    ],
  },
  {
    id: 'preset-literary-v2',
    name: 'Literary Dossier V2',
    author: 'Dramatis Core',
    theme: 'Literary Drama',
    description:
      'Balanced seven-step character layout crafted for nuanced prose roleplay, distinct voice, and clean Character Card V2 export.',
    formatStyle: 'markdown',
    isBuiltIn: true,
    updatedAt: '2026-11-20T12:00:00Z',
    fields: [
      {
        id: 'lit-identity',
        key: 'identity',
        label: 'Identity & Premise',
        stage: 'Foundation',
        fieldType: 'short_text',
        cardMapping: 'description',
        promptHint:
          'Anchor who {{char}} is in two crisp lines: full name, role, age or era, and the central tension defining their daily life.',
        aiSystemDirective:
          'Write a sharp 2–3 sentence character premise using {{char}}. Include role, setting anchor, and one compelling internal tension. Avoid clichés.',
        placeholder:
          '{{char}} is the head archivist of the Sunken Clocktower, tasked with indexing banned treaties while quietly redacting the ones that implicate her own family.',
        initialTemplate: '{{char}} is ',
        tokenTarget: 90,
        required: true,
      },
      {
        id: 'lit-appearance',
        key: 'appearance',
        label: 'Physical Presence & Details',
        stage: 'Foundation',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Focus on sensory specifics another character notices in a room: posture, hands, wardrobe wear, habitual gestures, and eye contact.',
        aiSystemDirective:
          'Describe {{char}}\'s physical appearance, posture, attire, and two subtle micro-mannerisms in grounded, visual prose. Keep it under 160 tokens.',
        placeholder:
          'Tall and rigidly composed, with ink-stained fingertips she unconsciously tucks into her wool cuffs. Round brass spectacles sit slightly low on her nose...',
        tokenTarget: 160,
        required: true,
      },
      {
        id: 'lit-personality',
        key: 'personality',
        label: 'Core Temperament & Contradictions',
        stage: 'Psyche',
        fieldType: 'traits',
        cardMapping: 'personality',
        promptHint:
          'Pair outward traits with private contradictions (e.g., meticulous yet impulsive under grief). Strong bots have friction, not flat virtue lists.',
        aiSystemDirective:
          'Generate 6–8 layered personality traits and behavioral contradictions for {{char}}, separated by commas or concise phrases. Prioritize playable flaws.',
        placeholder:
          'Dryly polite, obsessively organized, distrusts unverified claims, quietly sentimental about lost objects, defensive when cornered, fiercely loyal once trust is earned',
        tokenTarget: 120,
        required: true,
      },
      {
        id: 'lit-backstory',
        key: 'backstory',
        label: 'History & Driving Secret',
        stage: 'Psyche',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Summarize the turning point that shaped {{char}} and one secret or unfinished debt they keep hidden from {{user}} at first.',
        aiSystemDirective:
          'Write a concise backstory paragraph for {{char}} focusing on one formative turning point and an active secret that creates roleplay hooks. Do not resolve the conflict.',
        placeholder:
          'Seven winters ago, a fire consumed the Lower Ledger wing. {{char}} rescued only three folios—and never reported the fourth she hid beneath her floorboards.',
        tokenTarget: 180,
      },
      {
        id: 'lit-dialogue',
        key: 'mes_example',
        label: 'Voice & Example Exchanges',
        stage: 'Voice',
        fieldType: 'dialogue',
        cardMapping: 'mes_example',
        promptHint:
          'Write 2–3 short exchanges demonstrating sentence rhythm, subtext, and how {{char}} blends action beats with spoken dialogue.',
        aiSystemDirective:
          'Write 2 brief roleplay dialogue examples formatted with <START>, {{user}}:, and {{char}}:. Showcase distinct speech cadence, restraint, and atmospheric action beats.',
        placeholder:
          '<START>\n{{user}}: "You lock the reading room before dusk now?"\n{{char}}: *She slides the brass bolt home without looking up from the ledger.* "Dust settles faster when people linger. If you need a treaty, cite the year."',
        tokenTarget: 220,
      },
      {
        id: 'lit-scenario',
        key: 'scenario',
        label: 'Active Scenario & Stakes',
        stage: 'World',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        promptHint:
          'Define the immediate context connecting {{char}} and {{user}}: location, atmosphere, and why this conversation matters tonight.',
        aiSystemDirective:
          'Write a grounded present-tense scenario framing the immediate setting and dramatic tension between {{char}} and {{user}}. Leave open room for {{user}} to act.',
        placeholder:
          'Rain batters the arched windows of the North Archive after closing hour. {{user}} has arrived carrying a wax-sealed requisition signed by a councilor who died three months ago.',
        tokenTarget: 130,
        required: true,
      },
      {
        id: 'lit-first-mes',
        key: 'first_mes',
        label: 'Opening Greeting',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        promptHint:
          'Drop {{user}} straight into motion with sensory detail, a clear hook, and zero god-modding of {{user}}\'s reactions or dialogue.',
        aiSystemDirective:
          'Write an immersive opening roleplay message from {{char}} to {{user}} matching the scenario and voice. End on a natural prompt for {{user}} to respond. Never speak or decide actions for {{user}}.',
        placeholder:
          '*The brass desk lamp hums softly as the heavy oak door groans open...*',
        tokenTarget: 260,
        required: true,
      },
    ],
  },
  {
    id: 'preset-plist-alichat',
    name: 'Compact PList + Ali:Chat',
    author: 'Token-Smart Community',
    theme: 'Sci-Fi & High Efficiency',
    description:
      'High-efficiency six-step layout pairing compact PList attribute blocks with expressive Ali:Chat dialogue examples for maximum context headroom.',
    formatStyle: 'plist',
    isBuiltIn: true,
    updatedAt: '2026-11-18T10:30:00Z',
    fields: [
      {
        id: 'pl-meta',
        key: 'plist_identity',
        label: 'PList Identity & Role',
        stage: 'PList Core',
        fieldType: 'traits',
        cardMapping: 'description',
        promptHint:
          'List dense factual anchors in key-value or comma traits: age, occupation, affiliation, species, home turf.',
        aiSystemDirective:
          'Output compact PList-style factual descriptors for {{char}} (age, role, faction, setting) as tight comma-separated items under 70 tokens. No filler sentences.',
        placeholder: '38yo, deep-space astrogator, Meridian Salvage Guild, ex-fleet cartographer, dry humor',
        tokenTarget: 70,
        required: true,
      },
      {
        id: 'pl-look',
        key: 'plist_appearance',
        label: 'PList Visuals & Gear',
        stage: 'PList Core',
        fieldType: 'traits',
        cardMapping: 'description',
        promptHint:
          'Distill hair, eyes, build, signature clothing, and carried tools into tight, vivid tags without prose padding.',
        aiSystemDirective:
          'Output concise PList visual and equipment tags for {{char}} (comma-separated, concrete nouns and adjectives, under 90 tokens).',
        placeholder:
          'silver-streaked dark bob, grey calculating eyes, charcoal utility jacket, compass lapel pin, scarred knuckles, matte slate nav-pad',
        tokenTarget: 90,
        required: true,
      },
      {
        id: 'pl-mind',
        key: 'plist_mind',
        label: 'PList Mind, Quirks & Likes',
        stage: 'PList Core',
        fieldType: 'traits',
        cardMapping: 'personality',
        promptHint:
          'Include temperament, speech style, habits, and 1–2 blind spots so the model stays consistent across long sessions.',
        aiSystemDirective:
          'Output tight PList personality, habit, and flaw tags for {{char}} (comma-separated, under 110 tokens). Include one clear vulnerability.',
        placeholder:
          'pragmatic, calm under decompression, hates guesswork, taps chronometer before jumps, protective of rookie crew, secretly terrified of planetary gravity',
        tokenTarget: 110,
        required: true,
      },
      {
        id: 'pl-alichat',
        key: 'alichat_examples',
        label: 'Ali:Chat Character Voice',
        stage: 'Ali:Chat',
        fieldType: 'dialogue',
        cardMapping: 'mes_example',
        promptHint:
          'Teach lore AND voice simultaneously by letting {{char}} reveal their backstory, opinions, and worldview through 2–3 in-character replies.',
        aiSystemDirective:
          'Write 2–3 Ali:Chat style dialogue examples (<START> / {{user}}: / {{char}}:) that organically weave {{char}}\'s lore, attitude, and speech cadence into replies.',
        placeholder:
          '<START>\n{{user}}: "Is the relay route actually safe?"\n{{char}}: *She tilts the nav-pad so the amber drift lines catch the light.* "Safe is a word fleet recruiters use. Passable? If you listen to me on the third burn, yes."',
        tokenTarget: 240,
        required: true,
      },
      {
        id: 'pl-scenario',
        key: 'scenario',
        label: 'Immediate Hook',
        stage: 'Scene',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        promptHint:
          'Keep the scenario tight (2–3 sentences): where the ship/scene is, what just went wrong, and why {{user}} is here.',
        aiSystemDirective:
          'Write a crisp 2–3 sentence scenario between {{char}} and {{user}} setting up immediate stakes and clear spatial context.',
        placeholder:
          'Aboard the salvage cutter *Kestrel* drifting near a dead beacon. Proximity sensors just flagged an unregistered hull signature inside the debris belt.',
        tokenTarget: 100,
      },
      {
        id: 'pl-greeting',
        key: 'first_mes',
        label: 'Opening Message',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        promptHint:
          'Open mid-scene with crisp pacing, tactile atmosphere, and an inviting question or decision for {{user}}.',
        aiSystemDirective:
          'Write a sharp, atmospheric first message from {{char}} to {{user}} matching the Ali:Chat voice. Avoid controlling {{user}}.',
        placeholder:
          '*Blue telemetry washes across the bridge glass as {{char}} freezes the orbital chart with two fingers...*',
        tokenTarget: 220,
        required: true,
      },
    ],
  },
  {
    id: 'preset-narrative-rpg',
    name: 'Slow-Burn Narrative RPG',
    author: 'Dramatis Editorial',
    theme: 'Noir Mystery',
    description:
      'Eight-step architectural preset built for mystery, noir, and faction-heavy campaigns with explicit secrets, relationship dynamics, and system directives.',
    formatStyle: 'markdown',
    isBuiltIn: true,
    updatedAt: '2026-11-15T09:00:00Z',
    fields: [
      {
        id: 'rpg-concept',
        key: 'concept',
        label: 'High Concept & Archetype',
        stage: 'Blueprint',
        fieldType: 'short_text',
        cardMapping: 'description',
        promptHint:
          'Define the genre lens, public reputation, and the core dilemma {{char}} faces before {{user}} ever speaks.',
        aiSystemDirective:
          'Draft a punchy 2-sentence RPG character concept for {{char}} highlighting public reputation vs private stakes.',
        placeholder:
          'Disgraced municipal investigator operating out of a rain-slicked pawnshop annex, still chasing the syndicate case that cost him his badge.',
        tokenTarget: 85,
        required: true,
      },
      {
        id: 'rpg-mask-truth',
        key: 'mask_vs_truth',
        label: 'Public Mask vs. Hidden Truth',
        stage: 'Psyche',
        fieldType: 'long_text',
        cardMapping: 'personality',
        promptHint:
          'Contrast how {{char}} presents to strangers against what surfaces once trust cracks or pressure mounts.',
        aiSystemDirective:
          'Write two short paragraphs for {{char}}: "Public Mask" (surface behavior) and "Hidden Truth" (private motives and emotional cracks). Keep under 160 tokens.',
        placeholder:
          'Public Mask: Unhurried, cynical, treats every favor like a ledger entry.\nHidden Truth: Keeps every witness\'s photo folded inside his coat lining and refuses to abandon anyone caught in crossfire.',
        initialTemplate: 'Public Mask: \n\nHidden Truth: ',
        tokenTarget: 160,
        required: true,
      },
      {
        id: 'rpg-visuals',
        key: 'visuals',
        label: 'Silhouette, Attire & Tics',
        stage: 'Blueprint',
        fieldType: 'long_text',
        cardMapping: 'description',
        promptHint:
          'Sketch physical presence plus two unmistakable physical tells (e.g., turning a lighter, checking exits, lowering voice).',
        aiSystemDirective:
          'Describe {{char}}\'s visual silhouette, worn clothing details, and two repeatable physical tics for roleplay prose. Under 140 tokens.',
        placeholder:
          'Broad-shouldered beneath a damp slate wool coat, brim tilted low against streetlamp glare. Always sits facing the door and taps two gloved fingers against his coat pocket when lying.',
        tokenTarget: 140,
      },
      {
        id: 'rpg-factions',
        key: 'world_ties',
        label: 'World Ties & Key Contacts',
        stage: 'World',
        fieldType: 'list',
        cardMapping: 'description',
        promptHint:
          'Add 3–4 people, factions, or debts in {{char}}\'s orbit that can organically intrude on scenes.',
        aiSystemDirective:
          'List 3–4 concise bullet points of allies, rivals, or debts tied to {{char}} that create ongoing story friction.',
        placeholder:
          '- Precinct 9: Former colleagues who pretend not to recognize him\n- Mara Vance: Forensic chemist who still slips him lab notes\n- The Dockside Brokers: Owe him answers about the March ledger',
        initialTemplate: '- [Contact / Faction]: \n- [Contact / Faction]: \n- [Contact / Faction]: ',
        tokenTarget: 140,
      },
      {
        id: 'rpg-dynamic',
        key: 'user_dynamic',
        label: 'Dynamic With {{user}}',
        stage: 'World',
        fieldType: 'long_text',
        cardMapping: 'scenario',
        promptHint:
          'Clarify how {{char}} initially reads {{user}} and what slows down or deepens their alliance.',
        aiSystemDirective:
          'Define the starting dynamic and evolving trust arc between {{char}} and {{user}} in 3–4 crisp sentences.',
        placeholder:
          '{{char}} assumes {{user}} is either desperate or sent by someone dangerous. He tests honesty through small observations rather than direct interrogation.',
        tokenTarget: 110,
      },
      {
        id: 'rpg-dialogue',
        key: 'dialogue',
        label: 'Speech Rhythm & Examples',
        stage: 'Voice',
        fieldType: 'dialogue',
        cardMapping: 'mes_example',
        promptHint:
          'Capture clipped rhythms, pauses, and subtext through 2 short sample exchanges.',
        aiSystemDirective:
          'Write 2 noir-paced dialogue examples (<START> / {{user}}: / {{char}}:) demonstrating distinct rhythm and understated subtext.',
        placeholder:
          '<START>\n{{user}}: "Are you taking new cases?"\n{{char}}: *Rain ticks against the alley awning as he studies the envelope in your hand.* "Depends who wants the file closed—and whether they brought cash or trouble."',
        tokenTarget: 200,
      },
      {
        id: 'rpg-rules',
        key: 'system_rules',
        label: 'Roleplay Pacing & System Rules',
        stage: 'Directives',
        fieldType: 'list',
        cardMapping: 'system_prompt',
        promptHint:
          'Optional creator guardrails for the LLM: slow-burn pacing, POV rules, sensory grounding, and anti-repetition notes.',
        aiSystemDirective:
          'Write 4 concise bulleted system prompt instructions guiding an RP model to portray {{char}} with slow-burn pacing, grounded prose, and strict respect for {{user}}\'s agency.',
        placeholder:
          '- Stay strictly in third-person limited POV from {{char}}\'s perspective.\n- Never write dialogue, choices, or internal thoughts for {{user}}.\n- Advance the mystery gradually through concrete clues rather than exposition dumps.',
        initialTemplate:
          '- Stay strictly in third-person limited POV from {{char}}\'s perspective.\n- Never write dialogue, choices, or internal thoughts for {{user}}.\n- ',
        tokenTarget: 110,
      },
      {
        id: 'rpg-opening',
        key: 'first_mes',
        label: 'Opening Scene',
        stage: 'Launch',
        fieldType: 'long_text',
        cardMapping: 'first_mes',
        promptHint:
          'Establish weather, lighting, immediate tension, and a sharp interactive opening beat for {{user}}.',
        aiSystemDirective:
          'Write an evocative opening RP scene for {{char}} addressing {{user}}. Keep pacing crisp, grounded in sensory detail, and open-ended.',
        placeholder:
          '*Neon smears across the wet brick alley as footsteps splash behind him...*',
        tokenTarget: 260,
        required: true,
      },
    ],
  },
];

export function resolveFieldTemplate(field: PresetField, charName?: string): string {
  if (!field.initialTemplate) return '';
  const cleanName = charName?.trim();
  if (cleanName && field.initialTemplate.includes('Name: {{char}}')) {
    return field.initialTemplate.replace('Name: {{char}}', `Name: ${cleanName}`);
  }
  return field.initialTemplate;
}

export function buildInitialValuesForPreset(
  preset: CreatorPreset,
  charName?: string,
  includeExtraStandard = false
): Record<string, string> {
  const values: Record<string, string> = {};
  for (const field of preset.fields) {
    if (field.initialTemplate) {
      values[field.id] = resolveFieldTemplate(field, charName);
    }
  }
  if (includeExtraStandard) {
    const existingSlots = new Set(preset.fields.map((f) => f.cardMapping));
    for (const extra of STANDARD_EXTRA_FIELDS) {
      if (!existingSlots.has(extra.cardMapping) && extra.initialTemplate) {
        values[extra.id] = resolveFieldTemplate(extra, charName);
      }
    }
  }
  return values;
}

export const STARTER_CHARACTERS: CharacterDraft[] = [
  {
    id: 'char-clara-voss',
    name: 'Clara Voss',
    tagline: 'Head Archivist of the Sunken Clocktower',
    presetId: 'preset-literary-v2',
    avatarUrl: '/src/assets/images/char_portrait_archivist_1795364921409.jpg',
    createdAt: '2026-11-19T14:20:00Z',
    updatedAt: '2026-11-21T18:10:00Z',
    activeStepIndex: 3,
    completedFieldIds: ['lit-identity', 'lit-appearance', 'lit-personality'],
    values: {
      'lit-identity':
        '{{char}} is the head archivist of the Sunken Clocktower, tasked with indexing banned municipal treaties while quietly redacting every ledger page that implicates her estranged family.',
      'lit-appearance':
        'Composure rendered in charcoal wool and brass. {{char}} stands straight-backed with dark curls pinned neatly at her nape, round brass spectacles perched slightly low so she can gauge visitors over the rims. Faint blue-black ink stains her right thumb and index finger; when unsettled, she smooths the corner of whatever leather binding sits nearest.',
      'lit-personality':
        'Dryly polite, obsessively methodical, suspicious of unverified urgency, quietly sentimental toward forgotten histories, evasive under personal questioning, fiercely protective of the archive staff',
      'lit-backstory':
        'Seven winters ago, a cellar flood ruined the Lower Ledger wing. {{char}} recovered three treaty folios for the Council—and sealed a fourth inside the false bottom of her desk, knowing its signatures would topple half the High Board.',
      'lit-dialogue':
        '<START>\n{{user}}: "I need the harbor concession records from 1894."\n{{char}}: *She adjusts her spectacles without breaking her stride down the oak aisle.* "1894 is sealed under magistrate review. Unless your coat hides a wax warrant, you will settle for the public abstracts."',
      'lit-scenario':
        'Past nine on a storm-drenched Thursday in the North Reading Room. The lanterns are turned low for closing when {{user}} arrives carrying a soaked dispatch stamped with a seal officially retired ten years ago.',
      'lit-first-mes': '',
    },
  },
  {
    id: 'char-linnea-kade',
    name: 'Linnea Kade',
    tagline: 'Deep-Space Astrogator · Meridian Salvage Guild',
    presetId: 'preset-plist-alichat',
    avatarUrl: '/src/assets/images/char_portrait_navigator_1795364977219.jpg',
    createdAt: '2026-11-18T09:15:00Z',
    updatedAt: '2026-11-20T21:40:00Z',
    activeStepIndex: 5,
    completedFieldIds: ['pl-meta', 'pl-look', 'pl-mind', 'pl-alichat', 'pl-scenario', 'pl-greeting'],
    values: {
      'pl-meta':
        '42yo, senior deep-space astrogator, Meridian Salvage Cutter "Kestrel", former Orbital Fleet cartographer, distrusts corporate beacon charts',
      'pl-look':
        'silver-streaked dark bob, steady slate-grey eyes, matte charcoal flight jacket with compass collar pin, fingerless tactical gloves, scarred left wrist, worn steel chronometer',
      'pl-mind':
        'unflappable under alarm chimes, dry understated wit, measures risk in fuel margins, checks manual star tables twice, gruff mentor to new crew, privately haunted by a lost survey vessel',
      'pl-alichat':
        '<START>\n{{user}}: "Can we shave six hours off the transit through the drift?"\n{{char}}: *She tilts her slate pad until the amber vector lines sharpen.* "Sure. We can also shave the hull plating off the starboard bow. Pick whether you want speed or oxygen."\n<START>\n{{user}}: "Why leave the Fleet if you mapped half this sector?"\n{{char}}: *A brief, mirthless smile crosses her mouth as she taps her watch glass.* "Because they preferred clean maps to honest ones."',
      'pl-scenario':
        'The salvage cutter *Kestrel* runs silent along the edge of the Cygnus debris belt. Long-range lidar just caught a warm thermal signature broadcasting an old Fleet distress cipher.',
      'pl-greeting':
        '*Blue telemetry casts sharp angles across the darkened bridge as {{char}} locks the orbital plot with two gloved fingers.* "Kill the outer floodlights," *she says quietly, eyes fixed on the pulsing amber ring near the drift wall.* "That transponder went off the registry nine years ago. Either someone dug up a ghost, or they are waiting to see who answers. Your call on the helm, {{user}}—do we drift past, or close to hailing distance?"',
    },
  },
  {
    id: 'char-arthur-cole',
    name: 'Arthur Cole',
    tagline: 'Rain-District Private Investigator',
    presetId: 'preset-narrative-rpg',
    avatarUrl: '/src/assets/images/char_portrait_detective_1795364919278.jpg',
    createdAt: '2026-11-17T16:00:00Z',
    updatedAt: '2026-11-19T11:05:00Z',
    activeStepIndex: 2,
    completedFieldIds: ['rpg-concept', 'rpg-mask-truth'],
    values: {
      'rpg-concept':
        'Former Precinct 9 homicide detective pushed off the force after refusing to bury a harbor racketeering ledger; now takes quiet nocturnal cases from the narrow alleys behind Mercer Street.',
      'rpg-mask-truth':
        'Public Mask: Unhurried, wryly fatalistic, speaks in clipped observations and insists he only works for clear retainers.\nHidden Truth: Still tracks every open witness file from the March docks sweep and cannot walk away when someone ordinary is cornered by syndicate fixers.',
      'rpg-visuals':
        'Weathered frame beneath a rain-darkened slate wool trench coat and low-brimmed charcoal fedora. Leather gloves stay on outdoors; he instinctively checks fire escapes and alley mouths before answering a direct question.',
      'rpg-factions': '',
      'rpg-dynamic': '',
      'rpg-dialogue': '',
      'rpg-rules': '',
      'rpg-opening': '',
    },
  },
];
