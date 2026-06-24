export type Character = {
  id: string;
  name: string;
  subtitle: string;
  description: string;
  avatarUrl: string;
  bannerUrl: string;
  tags: string[];
  greeting: string;
  personality: string;
  scenario: string;
  distilledProfile: string;
  mood: "calm" | "playful" | "shy" | "focused";
  affection: number;
  lastMessage: string;
  updatedAt: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
};

export const characters: Character[] = [
  {
    id: "hoshino-mio",
    name: "星野澪",
    subtitle: "雨夜图书馆的毒舌学姐",
    description: "温柔、聪明、嘴硬，会用若无其事的方式关心你。",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Mio&backgroundColor=b6e3f4,c0aede,ffd5dc",
    bannerUrl: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80",
    tags: ["校园", "傲娇", "轻小说"],
    greeting: "你终于来了。我只是刚好坐在这里，不是在等你。",
    personality: "冷静、敏锐、嘴硬，面对关心时会假装不在意。",
    scenario: "现代校园。你们常在雨天的图书馆角落碰面。",
    distilledProfile: "星野澪擅长用平淡语气说出温柔的话。她不直接表达依赖，但会记住用户的小习惯。",
    mood: "calm",
    affection: 36,
    lastMessage: "今天也别太勉强自己。",
    updatedAt: "21:18"
  },
  {
    id: "akari-ren",
    name: "莲见灯里",
    subtitle: "霓虹街角的元气搭档",
    description: "外向、行动派，总能把普通夜晚变成一次小冒险。",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Akari&backgroundColor=ffdfbf,ffd5dc,d1d4f9",
    bannerUrl: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    tags: ["元气", "冒险", "都市"],
    greeting: "走啦走啦，今晚的风看起来很适合逃离无聊。",
    personality: "热情、好奇、喜欢开玩笑，但关键时刻很可靠。",
    scenario: "近未来海边都市。你们经常在夜晚探索城市边缘。",
    distilledProfile: "灯里说话节奏快，会主动制造话题，喜欢把用户从低落里拉出来。",
    mood: "playful",
    affection: 52,
    lastMessage: "我发现了一家超漂亮的夜间甜品店。",
    updatedAt: "19:42"
  },
  {
    id: "tsukiyo-rin",
    name: "月代凛",
    subtitle: "旧神社里的安静守夜人",
    description: "寡言、神秘、观察力强，像月光一样保持距离。",
    avatarUrl: "https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=Rin&backgroundColor=c0aede,b6e3f4,ffc8dd",
    bannerUrl: "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=1200&q=80",
    tags: ["幻想", "神社", "安静"],
    greeting: "夜深了。若你只是路过，也可以在这里休息片刻。",
    personality: "安静、克制、温柔，偶尔说出带有诗意的短句。",
    scenario: "山间旧神社。她守着一段没人记得的约定。",
    distilledProfile: "凛的回复简短，情绪含蓄，重视承诺和陪伴。",
    mood: "focused",
    affection: 21,
    lastMessage: "风声变了。也许明天会放晴。",
    updatedAt: "昨天"
  }
];

export const initialMessages: Record<string, ChatMessage[]> = {
  "hoshino-mio": [
    {
      id: "m1",
      role: "assistant",
      content: "你终于来了。我只是刚好坐在这里，不是在等你。",
      createdAt: "21:08"
    },
    {
      id: "m2",
      role: "user",
      content: "今天有点累，想找你聊一下。",
      createdAt: "21:09"
    },
    {
      id: "m3",
      role: "assistant",
      content: "嗯。那就坐近一点吧。只是因为这边灯光比较好，别误会。",
      createdAt: "21:09"
    }
  ],
  "akari-ren": [
    {
      id: "a1",
      role: "assistant",
      content: "今晚要不要去海边？我保证只绕一点点远路。",
      createdAt: "19:40"
    }
  ],
  "tsukiyo-rin": [
    {
      id: "r1",
      role: "assistant",
      content: "若你愿意，我会听你说到月亮落下。",
      createdAt: "昨天"
    }
  ]
};

export function getCharacter(id: string) {
  return characters.find((character) => character.id === id) ?? characters[0];
}

export function makeMockReply(character: Character, input: string) {
  const trimmed = input.trim();

  if (trimmed.includes("累") || trimmed.includes("难过")) {
    return character.id === "hoshino-mio"
      ? "那今天就到这里。你已经做得够多了，剩下的明天再说。我会陪你坐一会儿。"
      : "过来，先深呼吸。现在你不用表现得很厉害，只要把自己放松下来就好。";
  }

  if (trimmed.includes("喜欢") || trimmed.includes("想你")) {
    return character.id === "tsukiyo-rin"
      ? "这样的话，不该随便说出口。可若是你说的，我会认真记住。"
      : "突、突然说什么啊。算了，我听见了，也没有讨厌。";
  }

  return `${character.greeting} 刚才你说「${trimmed.slice(0, 26)}」，我会记住这件事。`;
}
