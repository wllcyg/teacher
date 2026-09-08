import React from "react";
import { Modal, Grid, Button, type ModalProps } from "antd";
import { Popup } from "antd-mobile";
import { CloseOutlined } from "@ant-design/icons";

const { useBreakpoint } = Grid;

export interface AdaptiveModalProps extends Omit<ModalProps, "styles"> {
  drawerHeight?: string | number;
  styles?: ModalProps["styles"];
  drawerStyles?: any;
}

/**
 * 响应式弹窗容器：
 * - 📱 手机端（屏幕宽度 < 768px）：基于 antd-mobile 的原生 Popup 底栏弹层，手感顺滑、物理阻尼、单手友好并适配底部安全区；
 * - 💻 iPad / 平板（>= 768px）及 PC 桌面端：自动保持为优雅精致的居中 Modal，视觉比例完美。
 */
export const AdaptiveModal: React.FC<AdaptiveModalProps> = ({
  open,
  onCancel,
  onOk,
  confirmLoading,
  okText = "确定",
  cancelText = "取消",
  okButtonProps,
  cancelButtonProps,
  title,
  children,
  footer,
  width,
  drawerHeight,
  styles,
  drawerStyles,
  destroyOnClose = true,
  closable = true,
  ...rest
}) => {
  const screens = useBreakpoint();
  // screens.md 为 >= 768px（标准 iPad 竖屏宽度为 768px 及以上）
  // 仅在真实手机小屏（< 768px）时切换为 antd-mobile Popup；
  // iPad 与 PC 桌面端保持精致居中的 antd Modal
  const isPhone = !screens.md;

  if (isPhone) {
    // 处理移动端底部的按钮操作栏
    const mobileFooterNode: React.ReactNode =
      typeof footer === "function"
        ? (footer as any)(null, { OkBtn: () => null, CancelBtn: () => null })
        : footer === undefined && (onOk || onCancel)
        ? (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: 10,
              padding: "12px 20px calc(16px + env(safe-area-inset-bottom, 16px)) 20px",
              borderTop: "1px solid #f1f5f9",
              background: "#fff",
              ...drawerStyles?.footer,
            }}
          >
            {onCancel && (
              <Button onClick={onCancel as any} {...cancelButtonProps}>
                {cancelText}
              </Button>
            )}
            {onOk && (
              <Button
                type="primary"
                loading={confirmLoading}
                onClick={onOk as any}
                {...okButtonProps}
              >
                {okText}
              </Button>
            )}
          </div>
        )
        : footer !== null && footer !== undefined
        ? (
          <div
            style={{
              padding: "12px 20px calc(16px + env(safe-area-inset-bottom, 16px)) 20px",
              borderTop: "1px solid #f1f5f9",
              background: "#fff",
              ...drawerStyles?.footer,
            }}
          >
            {footer as React.ReactNode}
          </div>
        )
        : null;

    return (
      <Popup
        visible={open}
        onMaskClick={onCancel as any}
        position="bottom"
        destroyOnClose={destroyOnClose}
        bodyStyle={{
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          maxHeight: drawerHeight || "88vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#fff",
          ...drawerStyles?.content,
        }}
      >
        {/* 顶部指示把手 */}
        <div
          style={{
            width: 36,
            height: 4,
            background: "#cbd5e1",
            borderRadius: 2,
            margin: "10px auto 4px",
            flexShrink: 0,
          }}
        />

        {/* 顶栏（标题与关闭按钮） */}
        {(title || closable) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 20px 12px",
              borderBottom: "1px solid #f1f5f9",
              flexShrink: 0,
              ...drawerStyles?.header,
            }}
          >
            <div style={{ fontWeight: 600, fontSize: 16, color: "#1e293b" }}>
              {title}
            </div>
            {closable && (
              <div
                onClick={onCancel as any}
                style={{
                  cursor: "pointer",
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  background: "#f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: 12,
                }}
              >
                <CloseOutlined />
              </div>
            )}
          </div>
        )}

        {/* 内容滚动区域 */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: "16px 20px",
            ...drawerStyles?.body,
          }}
        >
          {children}
        </div>

        {/* 底部操作区 */}
        {mobileFooterNode}
      </Popup>
    );
  }

  // 💻 iPad (>=768px) 及 PC 桌面端：标准优雅居中 Modal
  return (
    <Modal
      open={open}
      onCancel={onCancel}
      onOk={onOk}
      confirmLoading={confirmLoading}
      okText={okText}
      cancelText={cancelText}
      okButtonProps={okButtonProps}
      cancelButtonProps={cancelButtonProps}
      title={title}
      footer={footer}
      width={width}
      centered
      closable={closable}
      destroyOnClose={destroyOnClose}
      styles={styles}
      {...rest}
    >
      {children}
    </Modal>
  );
};

export default AdaptiveModal;
