import type {
  ItemSelectionAudit,
  ItemVariant,
  SelectedItemSnapshot,
} from '../types'

export const ITEM_BANK_VERSION = 'GYZJ-QB-20260809-01'

const equivalent = (
  id: string,
  taskId: string,
  prompt: string,
  tags: string[],
  materials?: string[],
): ItemVariant => ({
  id,
  taskId,
  prompt,
  difficulty: '等价基础',
  tags,
  ...(materials ? { materials } : {}),
})

export const ITEM_BANK: Record<string, ItemVariant[]> = {
  'YY-01': [
    equivalent('YY-01-A', 'YY-01', '请拿起杯子，再把它放到左边的托盘里。', ['两步指令', '日常物品'], ['杯子', '托盘']),
    equivalent('YY-01-B', 'YY-01', '请拿起毛巾，再把它放到右边的椅子上。', ['两步指令', '日常物品'], ['毛巾', '椅子']),
    equivalent('YY-01-C', 'YY-01', '请拿起桌上的书，再把它放到篮子里。', ['两步指令', '日常物品'], ['书', '篮子']),
    equivalent('YY-01-D', 'YY-01', '请拿起勺子，再把它放到杯子旁边。', ['两步指令', '日常物品'], ['勺子', '杯子']),
    equivalent('YY-01-E', 'YY-01', '请拿起纸巾，再把它放到左边的盒子里。', ['两步指令', '日常物品'], ['纸巾', '盒子']),
    equivalent('YY-01-F', 'YY-01', '请拿起梳子，再把它放到毛巾上面。', ['两步指令', '日常物品'], ['梳子', '毛巾']),
    equivalent('YY-01-G', 'YY-01', '请拿起卡片，再把它放到右边的盘子里。', ['两步指令', '日常物品'], ['卡片', '盘子']),
    equivalent('YY-01-H', 'YY-01', '请拿起空水瓶，再把它放到桌子中央。', ['两步指令', '日常物品'], ['空水瓶', '桌子']),
  ],
  'YY-03': [
    equivalent('YY-03-A', 'YY-03', '请谈谈今天早上做过的一件事。', ['日常对话', '时间线索']),
    equivalent('YY-03-B', 'YY-03', '请说说您今天吃过的一样东西。', ['日常对话', '饮食']),
    equivalent('YY-03-C', 'YY-03', '请说说最近一次和家人聊天的内容。', ['日常对话', '家人']),
    equivalent('YY-03-D', 'YY-03', '请谈谈您平时喜欢做的一件事。', ['日常对话', '兴趣']),
    equivalent('YY-03-E', 'YY-03', '请说说今天外面的天气怎么样。', ['日常对话', '天气']),
    equivalent('YY-03-F', 'YY-03', '请介绍一下您现在住的房间。', ['日常对话', '环境']),
    equivalent('YY-03-G', 'YY-03', '请说说最近让您觉得开心的一件小事。', ['日常对话', '情绪']),
    equivalent('YY-03-H', 'YY-03', '请谈谈您以前常做的一件家务。', ['日常对话', '生活经历']),
  ],
  'ST-01': [
    equivalent('ST-01-A', 'ST-01', '请辨认依次出现的四个大字。', ['大字图卡', '常用字'], ['山', '水', '人', '家']),
    equivalent('ST-01-B', 'ST-01', '请辨认依次出现的四个大字。', ['大字图卡', '常用字'], ['日', '月', '田', '木']),
    equivalent('ST-01-C', 'ST-01', '请辨认依次出现的四个大字。', ['大字图卡', '常用字'], ['风', '雨', '花', '鸟']),
    equivalent('ST-01-D', 'ST-01', '请辨认依次出现的四个大字。', ['大字图卡', '常用字'], ['门', '车', '手', '足']),
    equivalent('ST-01-E', 'ST-01', '请辨认依次出现的四个大字。', ['大字图卡', '常用字'], ['衣', '食', '住', '行']),
    equivalent('ST-01-F', 'ST-01', '请辨认依次出现的四个大字。', ['大字图卡', '常用字'], ['东', '南', '西', '北']),
  ],
  'ST-02': [
    equivalent('ST-02-A', 'ST-02', '现在是正常音量提问：您今天感觉怎么样？', ['正常音量', '日常短句']),
    equivalent('ST-02-B', 'ST-02', '现在是正常音量提问：您早上吃饭了吗？', ['正常音量', '日常短句']),
    equivalent('ST-02-C', 'ST-02', '现在是正常音量提问：您现在口渴吗？', ['正常音量', '日常短句']),
    equivalent('ST-02-D', 'ST-02', '现在是正常音量提问：您昨晚睡得好吗？', ['正常音量', '日常短句']),
    equivalent('ST-02-E', 'ST-02', '现在是正常音量提问：您需要休息一下吗？', ['正常音量', '日常短句']),
    equivalent('ST-02-F', 'ST-02', '现在是正常音量提问：您知道现在在哪里吗？', ['正常音量', '日常短句']),
    equivalent('ST-02-G', 'ST-02', '现在是正常音量提问：房间里的温度合适吗？', ['正常音量', '日常短句']),
    equivalent('ST-02-H', 'ST-02', '现在是正常音量提问：您想喝温水还是凉水？', ['正常音量', '日常短句']),
  ],
  'XL-02': [
    equivalent('XL-02-A', 'XL-02', '请记住“苹果、钥匙、火车”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['苹果', '钥匙', '火车']),
    equivalent('XL-02-B', 'XL-02', '请记住“香蕉、毛巾、汽车”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['香蕉', '毛巾', '汽车']),
    equivalent('XL-02-C', 'XL-02', '请记住“橘子、杯子、轮船”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['橘子', '杯子', '轮船']),
    equivalent('XL-02-D', 'XL-02', '请记住“白菜、雨伞、飞机”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['白菜', '雨伞', '飞机']),
    equivalent('XL-02-E', 'XL-02', '请记住“鸡蛋、梳子、单车”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['鸡蛋', '梳子', '单车']),
    equivalent('XL-02-F', 'XL-02', '请记住“米饭、眼镜、巴士”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['米饭', '眼镜', '巴士']),
    equivalent('XL-02-G', 'XL-02', '请记住“豆腐、帽子、火车”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['豆腐', '帽子', '火车']),
    equivalent('XL-02-H', 'XL-02', '请记住“面包、鞋子、轮船”，完成下一项后再请您回忆。', ['三词回忆', '不同类别'], ['面包', '鞋子', '轮船']),
  ],
}

function stableHash(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function createItemSelection(
  residentId: string,
  selectedForDate = new Date().toISOString().slice(0, 10),
): ItemSelectionAudit {
  const selectionSeed = `${residentId}:${selectedForDate}:${ITEM_BANK_VERSION}`
  const items = Object.fromEntries(
    Object.entries(ITEM_BANK).map(([taskId, variants]) => {
      const variant = variants[stableHash(`${selectionSeed}:${taskId}`) % variants.length]
      const snapshot: SelectedItemSnapshot = {
        ...variant,
        materials: variant.materials ? [...variant.materials] : undefined,
        tags: [...variant.tags],
        bankVersion: ITEM_BANK_VERSION,
      }
      return [taskId, snapshot]
    }),
  )

  return {
    bankVersion: ITEM_BANK_VERSION,
    selectedForDate,
    selectionSeed,
    items,
  }
}

export function selectedItemFor(
  selection: ItemSelectionAudit | undefined,
  taskId: string,
) {
  return selection?.items[taskId] ?? null
}
