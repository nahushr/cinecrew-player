const DEMO_CHAT_LINES = [
  ['Maya', 'That replay was unreal!'],
  ['Aarav', 'The keeper never saw it coming 😄'],
  ['Jordan', 'What a finish!'],
  ['Maya', 'This match keeps getting better.'],
  ['Leo', 'The crowd is electric tonight 🔥'],
  ['Aarav', 'Great pass to set that up.'],
  ['Priya', 'Who do you think takes the next one?'],
  ['Jordan', 'Going with the home side.'],
  ['Leo', 'Same here — they look sharp.'],
  ['Maya', 'That was so close!'],
  ['Priya', '👏👏👏'],
  ['Aarav', 'Best game this week.'],
  ['Jordan', 'One more goal would seal it.'],
  ['Leo', 'Here we go again!'],
  ['Maya', 'Enjoying the stream, everyone 💙'],
];

export function createSampleChatMessages() {
  return DEMO_CHAT_LINES.map(([username, comment], index) => ({
    id: `demo-message-${index + 1}`,
    username,
    comment,
    timestamp: new Date(Date.now() - (DEMO_CHAT_LINES.length - index - 1) * 4 * 60 * 1000).toISOString(),
  }));
}
