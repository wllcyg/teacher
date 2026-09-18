# Python 入门教程

## 目录
1. [Python 简介](#python-简介)
2. [安装 Python](#安装-python)
3. [第一个 Python 程序](#第一个-python-程序)
4. [基础语法](#基础语法)
5. [数据类型](#数据类型)
6. [控制流程](#控制流程)
7. [函数](#函数)
8. [实战练习](#实战练习)

---

## Python 简介

Python 是一门简单易学、功能强大的编程语言。它具有：
- **简洁的语法**：代码易读易写
- **丰富的库**：可以做网站开发、数据分析、人工智能等
- **跨平台**：可在 Windows、Mac、Linux 上运行
- **广泛应用**：从网站到游戏，从自动化到科学计算

---

## 安装 Python

### 检查是否已安装
打开终端（Mac）或命令提示符（Windows），输入：
```bash
python3 --version
```

### 安装方法
- **Mac**：通常自带 Python，也可通过 Homebrew 安装
  ```bash
  brew install python3
  ```
- **Windows**：访问 [python.org](https://www.python.org/downloads/) 下载安装包
- **Linux**：
  ```bash
  sudo apt update
  sudo apt install python3
  ```

---

## 第一个 Python 程序

### 创建文件
创建一个名为 `hello.py` 的文件，写入：
```python
print("Hello, World!")
print("欢迎学习 Python！")
```

### 运行程序
在终端中运行：
```bash
python3 hello.py
```

**输出：**
```
Hello, World!
欢迎学习 Python！
```

---

## 基础语法

### 1. 注释
```python
# 这是单行注释

"""
这是多行注释
可以写很多行
"""

'''
这也是多行注释
'''
```

### 2. 变量
Python 不需要声明变量类型：
```python
# 变量赋值
name = "小明"
age = 18
height = 1.75
is_student = True

# 打印变量
print("姓名:", name)
print("年龄:", age)
```

### 3. 输入输出
```python
# 获取用户输入
name = input("请输入你的名字: ")
print("你好,", name)

# 格式化输出
age = 20
print(f"我今年 {age} 岁")  # f-string（推荐）
print("我今年 {} 岁".format(age))  # format 方法
print("我今年 %d 岁" % age)  # 旧式格式化
```

---

## 数据类型

### 1. 数字类型
```python
# 整数
a = 10
b = -5

# 浮点数
pi = 3.14
price = 99.9

# 基本运算
print(10 + 5)   # 加法: 15
print(10 - 5)   # 减法: 5
print(10 * 5)   # 乘法: 50
print(10 / 5)   # 除法: 2.0
print(10 // 3)  # 整除: 3
print(10 % 3)   # 取余: 1
print(2 ** 3)   # 幂运算: 8
```

### 2. 字符串
```python
# 创建字符串
text1 = "Hello"
text2 = 'World'
text3 = """多行
字符串"""

# 字符串操作
name = "Python"
print(name[0])        # 索引: P
print(name[0:3])      # 切片: Pyt
print(name + " 3.0")  # 拼接: Python 3.0
print(name * 2)       # 重复: PythonPython
print(len(name))      # 长度: 6

# 常用方法
text = "hello world"
print(text.upper())       # HELLO WORLD
print(text.lower())       # hello world
print(text.title())       # Hello World
print(text.replace("world", "Python"))  # hello Python
print(text.split())       # ['hello', 'world']
```

### 3. 列表（List）
```python
# 创建列表
fruits = ["苹果", "香蕉", "橙子"]
numbers = [1, 2, 3, 4, 5]
mixed = [1, "hello", 3.14, True]

# 访问元素
print(fruits[0])     # 苹果
print(fruits[-1])    # 橙子（最后一个）

# 修改列表
fruits.append("葡萄")        # 添加到末尾
fruits.insert(0, "草莓")     # 插入到指定位置
fruits.remove("香蕉")        # 删除指定元素
last = fruits.pop()         # 删除并返回最后一个元素

# 列表操作
print(len(fruits))          # 长度
print("苹果" in fruits)      # 检查是否存在
fruits.sort()               # 排序
fruits.reverse()            # 反转
```

### 4. 元组（Tuple）
```python
# 元组是不可变的列表
point = (10, 20)
colors = ("red", "green", "blue")

# 访问元素
print(point[0])  # 10

# 元组解包
x, y = point
print(f"x={x}, y={y}")
```

### 5. 字典（Dictionary）
```python
# 创建字典
student = {
    "name": "小明",
    "age": 18,
    "score": 95
}

# 访问值
print(student["name"])        # 小明
print(student.get("age"))     # 18

# 修改字典
student["age"] = 19           # 修改值
student["grade"] = "高三"      # 添加新键值对
del student["score"]          # 删除键值对

# 遍历字典
for key, value in student.items():
    print(f"{key}: {value}")
```

### 6. 集合（Set）
```python
# 创建集合（无序、不重复）
numbers = {1, 2, 3, 4, 5}
numbers.add(6)       # 添加元素
numbers.remove(1)    # 删除元素

# 集合运算
set1 = {1, 2, 3}
set2 = {3, 4, 5}
print(set1 | set2)   # 并集: {1, 2, 3, 4, 5}
print(set1 & set2)   # 交集: {3}
print(set1 - set2)   # 差集: {1, 2}
```

---

## 控制流程

### 1. 条件语句（if-elif-else）
```python
# 基本 if 语句
age = 18
if age >= 18:
    print("你是成年人")

# if-else
score = 85
if score >= 60:
    print("及格")
else:
    print("不及格")

# if-elif-else
score = 85
if score >= 90:
    print("优秀")
elif score >= 80:
    print("良好")
elif score >= 60:
    print("及格")
else:
    print("不及格")

# 多条件判断
age = 20
is_student = True
if age >= 18 and is_student:
    print("成年学生")
```

### 2. 循环语句

#### for 循环
```python
# 遍历列表
fruits = ["苹果", "香蕉", "橙子"]
for fruit in fruits:
    print(fruit)

# range() 函数
for i in range(5):        # 0 到 4
    print(i)

for i in range(1, 6):     # 1 到 5
    print(i)

for i in range(0, 10, 2): # 0, 2, 4, 6, 8
    print(i)

# 遍历字典
student = {"name": "小明", "age": 18}
for key, value in student.items():
    print(f"{key}: {value}")

# enumerate（带索引遍历）
for index, fruit in enumerate(fruits):
    print(f"{index}: {fruit}")
```

#### while 循环
```python
# 基本 while 循环
count = 0
while count < 5:
    print(count)
    count += 1

# 用户输入验证
password = ""
while password != "123456":
    password = input("请输入密码: ")
print("密码正确！")
```

### 3. 循环控制
```python
# break：跳出循环
for i in range(10):
    if i == 5:
        break
    print(i)  # 输出 0-4

# continue：跳过当前迭代
for i in range(5):
    if i == 2:
        continue
    print(i)  # 输出 0, 1, 3, 4

# pass：占位符
for i in range(5):
    if i == 2:
        pass  # 什么也不做
    print(i)
```

---

## 函数

### 1. 定义函数
```python
# 基本函数
def greet():
    print("Hello!")

greet()  # 调用函数

# 带参数的函数
def greet_person(name):
    print(f"Hello, {name}!")

greet_person("小明")

# 带返回值的函数
def add(a, b):
    return a + b

result = add(3, 5)
print(result)  # 8

# 默认参数
def greet(name, message="你好"):
    print(f"{message}, {name}!")

greet("小明")              # 你好, 小明!
greet("小红", "欢迎")      # 欢迎, 小红!

# 多个返回值
def get_name_age():
    return "小明", 18

name, age = get_name_age()
```

### 2. 函数进阶
```python
# 可变参数
def sum_all(*numbers):
    total = 0
    for num in numbers:
        total += num
    return total

print(sum_all(1, 2, 3, 4, 5))  # 15

# 关键字参数
def print_info(**info):
    for key, value in info.items():
        print(f"{key}: {value}")

print_info(name="小明", age=18, city="北京")

# Lambda 表达式（匿名函数）
square = lambda x: x ** 2
print(square(5))  # 25

numbers = [1, 2, 3, 4, 5]
squares = list(map(lambda x: x ** 2, numbers))
print(squares)  # [1, 4, 9, 16, 25]
```

---

## 实战练习

### 练习 1：猜数字游戏
```python
import random

# 生成随机数
secret_number = random.randint(1, 100)
attempts = 0

print("我想了一个 1-100 之间的数字，你能猜到吗？")

while True:
    guess = int(input("请输入你的猜测: "))
    attempts += 1
    
    if guess < secret_number:
        print("太小了！")
    elif guess > secret_number:
        print("太大了！")
    else:
        print(f"恭喜你猜对了！你用了 {attempts} 次")
        break
```

### 练习 2：计算器
```python
def calculator():
    print("简单计算器")
    print("1. 加法")
    print("2. 减法")
    print("3. 乘法")
    print("4. 除法")
    
    choice = input("请选择操作 (1-4): ")
    
    num1 = float(input("输入第一个数字: "))
    num2 = float(input("输入第二个数字: "))
    
    if choice == '1':
        print(f"结果: {num1 + num2}")
    elif choice == '2':
        print(f"结果: {num1 - num2}")
    elif choice == '3':
        print(f"结果: {num1 * num2}")
    elif choice == '4':
        if num2 != 0:
            print(f"结果: {num1 / num2}")
        else:
            print("错误：除数不能为 0")
    else:
        print("无效的选择")

calculator()
```

### 练习 3：待办事项列表
```python
def todo_list():
    todos = []
    
    while True:
        print("\n待办事项列表")
        print("1. 查看任务")
        print("2. 添加任务")
        print("3. 完成任务")
        print("4. 退出")
        
        choice = input("请选择操作: ")
        
        if choice == '1':
            if todos:
                for i, task in enumerate(todos, 1):
                    print(f"{i}. {task}")
            else:
                print("没有任务")
        
        elif choice == '2':
            task = input("请输入任务: ")
            todos.append(task)
            print("任务已添加！")
        
        elif choice == '3':
            if todos:
                for i, task in enumerate(todos, 1):
                    print(f"{i}. {task}")
                index = int(input("请输入要完成的任务编号: ")) - 1
                if 0 <= index < len(todos):
                    removed = todos.pop(index)
                    print(f"已完成: {removed}")
                else:
                    print("无效的编号")
            else:
                print("没有任务")
        
        elif choice == '4':
            print("再见！")
            break
        
        else:
            print("无效的选择")

todo_list()
```

### 练习 4：文本分析
```python
def analyze_text(text):
    # 统计字符数
    char_count = len(text)
    
    # 统计单词数
    words = text.split()
    word_count = len(words)
    
    # 统计字母出现次数
    letter_count = {}
    for char in text.lower():
        if char.isalpha():
            letter_count[char] = letter_count.get(char, 0) + 1
    
    print(f"字符数: {char_count}")
    print(f"单词数: {word_count}")
    print(f"字母统计: {letter_count}")

text = input("请输入一段文本: ")
analyze_text(text)
```

---

## 下一步学习

掌握了基础后，你可以学习：

1. **面向对象编程**：类、对象、继承
2. **文件操作**：读写文件
3. **异常处理**：try-except
4. **模块和包**：导入和使用库
5. **常用库**：
   - `requests`：网络请求
   - `pandas`：数据分析
   - `numpy`：科学计算
   - `flask/django`：Web 开发
   - `pygame`：游戏开发

---

## 学习资源

- [Python 官方文档](https://docs.python.org/zh-cn/3/)
- [菜鸟教程 Python](https://www.runoob.com/python3/python3-tutorial.html)
- [廖雪峰 Python 教程](https://www.liaoxuefeng.com/wiki/1016959663602400)
- 在线练习：[LeetCode](https://leetcode.cn/)、[牛客网](https://www.nowcoder.com/)

---

## 小贴士

1. **多写代码**：编程需要大量练习
2. **阅读错误信息**：错误提示会告诉你哪里出了问题
3. **使用搜索**：遇到问题先搜索，StackOverflow 是好朋友
4. **保持耐心**：编程学习需要时间，不要气馁
5. **做项目**：通过实际项目巩固知识

祝你学习愉快！🐍✨
