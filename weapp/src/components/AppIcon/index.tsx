import React from 'react'
import { View, Image } from '@tarojs/components'
import {
  Clock,
  Notice,
  Edit,
  Refresh,
  Del,
  Check,
  User,
  List,
  Setting,
  Tips,
} from '@nutui/icons-react-taro'
import './index.less'

export type IconName =
  | 'clock'
  | 'notice'
  | 'edit'
  | 'refresh'
  | 'del'
  | 'check'
  | 'user'
  | 'users'
  | 'list'
  | 'setting'
  | 'tips'
  | 'book'
  | 'bolt'
  | 'calendar'
  | 'todo'
  | 'crown'
  | 'quote'
  | 'history'
  | 'image'
  | 'redo'
  | 'chart'
  | 'share'
  | 'arrow-right'

interface AppIconProps {
  name: IconName
  size?: number | string
  color?: string
  className?: string
  style?: React.CSSProperties
}

/** 跨平台安全 Base64 转换器（确保微信小程序 100% 渲染 SVG 图标，杜绝空白） */
function utf8ToBase64(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
  let encoded = ''
  let c1: number, c2: number, c3: number, e1: number, e2: number, e3: number, e4: number
  let i = 0
  const utf8 = unescape(encodeURIComponent(str))
  while (i < utf8.length) {
    c1 = utf8.charCodeAt(i++)
    c2 = utf8.charCodeAt(i++)
    c3 = utf8.charCodeAt(i++)
    e1 = c1 >> 2
    e2 = ((c1 & 3) << 4) | (c2 >> 4)
    e3 = ((c2 & 15) << 2) | (c3 >> 6)
    e4 = c3 & 63
    if (isNaN(c2)) {
      e3 = e4 = 64
    } else if (isNaN(c3)) {
      e4 = 64
    }
    encoded += chars.charAt(e1) + chars.charAt(e2) + chars.charAt(e3) + chars.charAt(e4)
  }
  return encoded
}

// 针对所有高频图标内置标准高保真矢量 SVG 模板
const RAW_SVG_MAP: Record<string, (color: string) => string> = {
  bolt: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${c}" stroke="${c}" stroke-width="1"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,
  book: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,
  calendar: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,
  todo: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,
  users: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
  crown: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${c}"><path d="M2 19h20v2H2v-2zM2 5l5 3.5L12 3l5 5.5L22 5v12H2V5z"/></svg>`,
  quote: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${c}"><path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z"/></svg>`,
  bell: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  history: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  clock: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  notice: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>`,
  edit: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
  refresh: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,
  del: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
  check: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
  user: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  list: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>`,
  setting: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
  tips: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  image: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`,
  redo: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
  chart: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  share: (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  'arrow-right': (c) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>`,
}

export const AppIcon: React.FC<AppIconProps> = ({
  name,
  size = 18,
  color = '#1E293B',
  className = '',
  style = {},
}) => {
  const pixelSize = typeof size === 'number' ? `${size * 2}rpx` : size
  const svgRenderer = RAW_SVG_MAP[name]

  // 纯 CSS 矢量背景渲染，100% 兼容微信小程序 WebView 引擎，杜绝原生 Image 组件对 SVG Data-URI 的不兼容
  if (svgRenderer) {
    const rawSvg = svgRenderer(color)
    const base64Uri = `data:image/svg+xml;base64,${utf8ToBase64(rawSvg)}`

    return (
      <View
        className={`app-icon-wrapper ${className}`}
        style={{
          width: pixelSize,
          height: pixelSize,
          minWidth: pixelSize,
          minHeight: pixelSize,
          backgroundImage: `url("${base64Uri}")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
          backgroundSize: 'contain',
          display: 'inline-block',
          verticalAlign: 'middle',
          flexShrink: 0,
          ...style,
        }}
      />
    )
  }

  // 备用 NutUI 图标组件
  const numSize = typeof size === 'number' ? size : parseInt(size, 10) || 18

  return (
    <View
      className={`app-icon-wrapper ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        verticalAlign: 'middle',
        flexShrink: 0,
        ...style,
      }}
    >
      {name === 'clock' && <Clock color={color} size={numSize} />}
      {name === 'notice' && <Notice color={color} size={numSize} />}
      {name === 'edit' && <Edit color={color} size={numSize} />}
      {name === 'refresh' && <Refresh color={color} size={numSize} />}
      {name === 'del' && <Del color={color} size={numSize} />}
      {name === 'check' && <Check color={color} size={numSize} />}
      {name === 'user' && <User color={color} size={numSize} />}
      {name === 'list' && <List color={color} size={numSize} />}
      {name === 'setting' && <Setting color={color} size={numSize} />}
      {name === 'tips' && <Tips color={color} size={numSize} />}
    </View>
  )
}
