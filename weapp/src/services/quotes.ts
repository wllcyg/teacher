/**
 * 教师工作台专属：晨间寄语精选名言文库
 */

export const DAILY_QUOTES = [
  '晨光微露，心向阳光，愿您和孩子们度过充实美好的一天。',
  '教育的本质意味着，一棵树摇动另一棵树，一朵云推动另一朵云，一个灵魂唤醒另一个灵魂。',
  '学高为师，身正为范。每一次耐心的倾听，都是对孩子最好的滋养。',
  '教育不是注满一桶水，而是点燃一把火。让每一颗好奇的种子生根发芽。',
  '教学相长，在成就学生的旅程中，我们也遇见了更博大智慧的自己。',
  '爱是最好的教育，严慈相济，静待花开。',
  '每一堂精心准备的课，都是送给孩子们通往广阔世界的一扇窗。',
  '日日耕耘，终见芳华；润物细无声，师恩深似海。',
  '眼里有光，心中有爱，手中有法。致敬每一位在讲台默默坚守的师者。',
  '今天也是充满可能的一天，保持微笑，点亮课堂！',
]

/**
 * 随机获取一句寄语（支持避开当前句）
 */
export function getRandomQuote(excludeText?: string): string {
  const filtered = DAILY_QUOTES.filter(q => q !== excludeText)
  const list = filtered.length > 0 ? filtered : DAILY_QUOTES
  const idx = Math.floor(Math.random() * list.length)
  return list[idx]
}
