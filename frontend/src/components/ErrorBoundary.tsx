import React, { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Result, Typography, Collapse } from "antd";
import { ReloadOutlined, HomeOutlined, CopyOutlined, CheckOutlined } from "@ant-design/icons";

const { Text, Paragraph } = Typography;

interface Props {
  children: ReactNode;
  /** 可选：自定义兜底 UI */
  fallback?: ReactNode;
  /** 发生异常时的回调 */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  copied: boolean;
}

/**
 * 全局 React 错误边界组件
 * 捕获子组件树中的 JavaScript 运行期异常，展示友好卡片，杜绝整屏白屏
 */
export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    console.error("[ErrorBoundary 捕获异常]:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false });
    window.location.href = "/";
  };

  private handleCopyError = () => {
    const errorText = `【错误信息】: ${this.state.error?.message || "未知错误"}\n\n【调用堆栈】: ${
      this.state.error?.stack || ""
    }\n\n【组件堆栈】: ${this.state.errorInfo?.componentStack || ""}`;

    navigator.clipboard.writeText(errorText).then(() => {
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            padding: "32px 16px",
            minHeight: "60vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            maxWidth: 680,
            margin: "0 auto",
          }}
        >
          <Result
            status="warning"
            title="页面暂时遇到一点问题"
            subTitle="可能是临时网络波动或数据渲染异常，您的数据未丢失，可尝试重试或返回首页。"
            extra={[
              <Button
                type="primary"
                key="retry"
                icon={<ReloadOutlined />}
                onClick={this.handleReset}
              >
                重试加载
              </Button>,
              <Button key="reload" onClick={this.handleReload}>
                刷新整页
              </Button>,
              <Button key="home" icon={<HomeOutlined />} onClick={this.handleGoHome}>
                返回首页
              </Button>,
            ]}
          />

          {/* 异常技术详情折叠面板（便于排查） */}
          {this.state.error && (
            <div style={{ width: "100%", marginTop: 16 }}>
              <Collapse
                size="small"
                items={[
                  {
                    key: "1",
                    label: (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          查看异常排查信息
                        </Text>
                        <Button
                          size="small"
                          type="text"
                          icon={this.state.copied ? <CheckOutlined style={{ color: "#16a34a" }} /> : <CopyOutlined />}
                          onClick={(e) => {
                            e.stopPropagation();
                            this.handleCopyError();
                          }}
                          style={{ fontSize: 12 }}
                        >
                          {this.state.copied ? "已复制详情" : "复制详情"}
                        </Button>
                      </div>
                    ),
                    children: (
                      <div
                        style={{
                          background: "#f8fafc",
                          padding: 12,
                          borderRadius: 8,
                          fontSize: 12,
                          maxHeight: 220,
                          overflow: "auto",
                          fontFamily: "monospace",
                        }}
                      >
                        <Paragraph strong style={{ color: "#dc2626", marginBottom: 6 }}>
                          {this.state.error.name}: {this.state.error.message}
                        </Paragraph>
                        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-all", margin: 0, color: "#475569" }}>
                          {this.state.error.stack || this.state.errorInfo?.componentStack}
                        </pre>
                      </div>
                    ),
                  },
                ]}
              />
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
export default ErrorBoundary;
