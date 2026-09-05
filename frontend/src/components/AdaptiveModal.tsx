import React from "react";
import { Modal, Drawer, Grid, Button, Space, type ModalProps } from "antd";

const { useBreakpoint } = Grid;

export interface AdaptiveModalProps extends Omit<ModalProps, "styles"> {
  drawerHeight?: string | number;
  styles?: ModalProps["styles"];
  drawerStyles?: any;
}

/**
 * 响应式弹窗容器：
 * - 📱 手机端（屏幕宽度 < 768px）：自动降级为底部半屏抽屉（Bottom Sheet），适配单手操作与虚拟键盘；
 * - 💻 iPad / 平板（>= 768px）及 PC 桌面端：自动保持为优雅精致的居中 Modal，视觉比例完美，绝不拉伸变形。
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
  drawerHeight = "auto",
  styles,
  drawerStyles,
  destroyOnClose = true,
  closable = true,
  ...rest
}) => {
  const screens = useBreakpoint();
  // screens.md 为 >= 768px（标准 iPad 竖屏宽度为 768px 及以上）
  // 仅在真实手机小屏（< 768px）时切换为底部抽屉；
  // iPad 与 PC 桌面端保持精致居中的 Modal，视觉体验零负面影响！
  const isPhone = !screens.md;

  if (isPhone) {
    // 处理移动端底部抽屉的默认按钮操作栏
    const drawerFooterNode: React.ReactNode =
      typeof footer === "function"
        ? (footer as any)(null, { OkBtn: () => null, CancelBtn: () => null })
        : footer === undefined && (onOk || onCancel)
        ? (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
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
        : (footer as React.ReactNode);

    return (
      <Drawer
        placement="bottom"
        height={drawerHeight}
        open={open}
        onClose={onCancel as any}
        title={title}
        footer={drawerFooterNode}
        closable={closable}
        destroyOnClose={destroyOnClose}
        styles={{
          content: {
            maxWidth: 600,
            margin: "0 auto",
            borderTopLeftRadius: 16,
            borderTopRightRadius: 16,
            overflow: "hidden",
            maxHeight: "90vh",
            ...drawerStyles?.content,
          },
          header: {
            padding: "16px 20px 12px",
            borderBottom: "1px solid #F1F5F9",
            ...drawerStyles?.header,
          },
          body: {
            padding: "16px 20px 24px",
            overflowY: "auto",
            ...drawerStyles?.body,
          },
          footer: {
            padding: "12px 20px 16px",
            borderTop: "1px solid #F1F5F9",
            ...drawerStyles?.footer,
          },
        }}
      >
        {children}
      </Drawer>
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
