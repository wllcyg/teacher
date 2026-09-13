export default {
  pages: [
    'pages/index/index',
    'pages/schedule/index',
    'pages/todos/index',
    'pages/roster/index',
    'pages/quicknote/index',
    'pages/periods/index',
    'pages/lessonlogs/index',
    'pages/lessonlog-edit/index',
    'pages/my/index',
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#F7F8FA',
    navigationBarTitleText: '教师工作台',
    navigationBarTextStyle: 'black',
    backgroundColor: '#F7F8FA',
  },
  tabBar: {
    color: '#8E8E93',
    selectedColor: '#2563EB',
    backgroundColor: '#FFFFFF',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/index/index',
        text: '工作台',
        iconPath: 'assets/icons/tab-home.png',
        selectedIconPath: 'assets/icons/tab-home-active.png',
      },
      {
        pagePath: 'pages/quicknote/index',
        text: '快记',
        iconPath: 'assets/icons/tab-quicknote.png',
        selectedIconPath: 'assets/icons/tab-quicknote-active.png',
      },
      {
        pagePath: 'pages/roster/index',
        text: '名册',
        iconPath: 'assets/icons/tab-roster.png',
        selectedIconPath: 'assets/icons/tab-roster-active.png',
      },
      {
        pagePath: 'pages/todos/index',
        text: '待办',
        iconPath: 'assets/icons/tab-todo.png',
        selectedIconPath: 'assets/icons/tab-todo-active.png',
      },
      {
        pagePath: 'pages/my/index',
        text: '我的',
        iconPath: 'assets/icons/tab-user.png',
        selectedIconPath: 'assets/icons/tab-user-active.png',
      },
    ],
  },
}
