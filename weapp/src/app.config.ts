export default {
  pages: [
    'pages/index/index',
    'pages/my/index',
    'pages/students/index',
    'pages/class-create/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#EDEDED',
    navigationBarTitleText: '教师工作台',
    navigationBarTextStyle: 'black',
    backgroundColor: '#EDEDED'
  },
  tabBar: {
    color: '#8E8E93',
    selectedColor: '#2563EB',
    backgroundColor: '#F7F7F7',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '工作台',
        iconPath: 'assets/icons/tab-home.png',
        selectedIconPath: 'assets/icons/tab-home-active.png'
      },
      {
        pagePath: 'pages/my/index',
        text: '我的',
        iconPath: 'assets/icons/tab-user.png',
        selectedIconPath: 'assets/icons/tab-user-active.png'
      }
    ]
  }
}
