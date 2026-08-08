import type { DimensionKey, TaskDefinition } from '../types'

export const DIMENSION_ORDER: DimensionKey[] = [
  'mobility',
  'speech',
  'sensory',
  'psychology',
  'adl',
]

export const DIMENSION_META: Record<
  DimensionKey,
  { label: string; shortLabel: string; color: string }
> = {
  mobility: { label: '肢体活动', shortLabel: '肢体', color: '#0f6b58' },
  speech: { label: '言语沟通', shortLabel: '言语', color: '#24518e' },
  sensory: { label: '视听能力', shortLabel: '视听', color: '#6a4f98' },
  psychology: { label: '心理与认知', shortLabel: '心理', color: '#a8690b' },
  adl: { label: '日常生活能力', shortLabel: '生活', color: '#5d625e' },
}

export const TASK_DEFINITIONS: Record<DimensionKey, TaskDefinition[]> = {
  mobility: [
    {
      id: 'ZT-01',
      dimension: 'mobility',
      label: '坐起并坐稳',
      prompt: '请从靠坐状态坐直并保持稳定。',
      levels: ['独立且平稳', '借助扶手完成', '需要他人搀扶', '无法完成'],
    },
    {
      id: 'ZT-02',
      dimension: 'mobility',
      label: '床椅转移',
      prompt: '请从座椅起身，转移到旁边座椅。',
      levels: ['独立完成', '借助辅具完成', '需要搀扶', '无法完成'],
    },
    {
      id: 'ZT-03',
      dimension: 'mobility',
      label: '行走并转身',
      prompt: '请向前行走数步，转身后回到原位。',
      levels: ['独立平稳', '借助辅具', '需要监护或搀扶', '无法完成'],
    },
    {
      id: 'ZT-04',
      dimension: 'mobility',
      label: '抬臂过肩',
      prompt: '请分别抬起左右手臂超过肩部。',
      levels: ['双侧完成', '单侧受限', '双侧明显受限', '无法完成'],
    },
    {
      id: 'ZT-05',
      dimension: 'mobility',
      label: '手指抓放',
      prompt: '请完成拇指对指，并抓起再放下桌面物品。',
      levels: ['动作稳定', '轻微迟缓', '抓放不稳需协助', '无法完成'],
    },
  ],
  speech: [
    {
      id: 'YY-01',
      dimension: 'speech',
      label: '执行两步指令',
      prompt: '请拿起杯子，再把它放到左边。',
      levels: ['一次正确', '重复后正确', '手势提示后部分完成', '无法理解'],
    },
    {
      id: 'YY-02',
      dimension: 'speech',
      label: '表达基本需求',
      prompt: '如果您想喝水，会怎样告诉护理人员？',
      levels: ['表达完整清楚', '简单但可理解', '主要靠单字或手势', '无法表达'],
    },
    {
      id: 'YY-03',
      dimension: 'speech',
      label: '三轮日常对话',
      prompt: '请谈谈今天早上做过的一件事。',
      levels: ['回答连贯', '一次答非所问', '两次答非所问', '无法维持对话'],
    },
  ],
  sensory: [
    {
      id: 'ST-01',
      dimension: 'sensory',
      label: '辨认大字图卡',
      prompt: '请辨认屏幕上依次出现的四个大字。',
      levels: ['辨认4个', '辨认3个', '辨认1至2个', '无法辨认'],
    },
    {
      id: 'ST-02',
      dimension: 'sensory',
      label: '正常音量应答',
      prompt: '请在听到正常音量提问后回答。',
      levels: ['全部正确', '提高音量后正确', '需要贴近耳边', '无法听清'],
    },
    {
      id: 'ST-03',
      dimension: 'sensory',
      label: '环境提示反应',
      prompt: '观察其对呼叫铃或敲门声的反应。',
      levels: ['立即反应', '反应延迟', '多次提示才反应', '无反应'],
    },
  ],
  psychology: [
    {
      id: 'XL-01',
      dimension: 'psychology',
      label: '时间地点定向',
      prompt: '请说出今天的大概日期和您现在所在的地方。',
      levels: ['两项正确', '一项正确', '仅能回答季节或城市', '完全不能回答'],
    },
    {
      id: 'XL-02',
      dimension: 'psychology',
      label: '三词延迟回忆',
      prompt: '请记住三个词，稍后再进行回忆。',
      levels: ['回忆3个', '回忆2个', '回忆1个', '无法回忆'],
    },
    {
      id: 'XL-03',
      dimension: 'psychology',
      label: '人物辨认',
      prompt: '请辨认陪同人员或经过授权的亲属照片。',
      levels: ['正确辨认', '迟疑后正确', '认错但可纠正', '无法辨认'],
    },
    {
      id: 'XL-04',
      dimension: 'psychology',
      label: '近两周状态',
      prompt: '近两周的睡眠、食欲和兴趣是否有明显变化？',
      levels: ['无关注项', '一个关注项', '两个关注项', '三个以上或持续哭泣'],
    },
    {
      id: 'XL-05',
      dimension: 'psychology',
      label: '意识与行为观察',
      prompt: '结合现场状态和既往护理记录进行观察。',
      levels: ['无异常', '偶发烦躁', '存在攻击行为记录', '唤醒困难或伤人风险'],
    },
  ],
  adl: [
    {
      id: 'RC-01',
      dimension: 'adl',
      label: '进食',
      prompt: '记录日常进食所需协助。',
      levels: ['独立进食', '需要准备协助', '需要部分喂食', '完全依赖'],
    },
    {
      id: 'RC-02',
      dimension: 'adl',
      label: '穿脱上衣',
      prompt: '记录穿脱上衣所需协助。',
      levels: ['独立完成', '需要摆放协助', '需要大部分帮助', '完全依赖'],
    },
    {
      id: 'RC-03',
      dimension: 'adl',
      label: '如厕',
      prompt: '记录如厕和清洁所需协助。',
      levels: ['独立完成', '需要提醒或搀扶', '需要清洁协助', '完全依赖'],
    },
    {
      id: 'RC-04',
      dimension: 'adl',
      label: '个人卫生',
      prompt: '记录洗漱和洗澡所需协助。',
      levels: ['独立完成', '洗澡需要看护', '洗漱也需协助', '完全依赖'],
    },
    {
      id: 'RC-05',
      dimension: 'adl',
      label: '服药管理',
      prompt: '结合护理记录确认服药管理能力。',
      levels: ['自行按时按量', '需要提醒', '需要摆药到手', '完全代管'],
    },
  ],
}

export const GRADE_LABELS: Record<number, string> = {
  0: '正常完成',
  1: '轻度关注',
  2: '需要协助',
  3: '重点复核',
}
