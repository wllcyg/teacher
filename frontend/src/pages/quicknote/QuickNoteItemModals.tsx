import React, { useEffect } from "react";
import { Form, Input, Select } from "antd";
import { AdaptiveModal } from "../../components/AdaptiveModal";

interface NewItemModalProps {
  open: boolean;
  onClose: () => void;
  defaultType?: "学业" | "表现";
  onCreate: (vals: {
    项目名: string;
    类型: "学业" | "表现";
    计分制: string;
  }) => Promise<void>;
}

export const NewItemModal: React.FC<NewItemModalProps> = ({
  open,
  onClose,
  defaultType = "表现",
  onCreate,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        类型: defaultType,
        计分制: defaultType === "表现" ? "加减分" : "过关",
      });
    }
  }, [open, defaultType, form]);

  const handleOk = () => {
    form.submit();
  };

  const handleFinish = async (vals: any) => {
    await onCreate(vals);
    form.resetFields();
  };

  return (
    <AdaptiveModal
      title="新项目"
      open={open}
      onCancel={onClose}
      onOk={handleOk}
      okText="创建项目"
    >
      <div style={{ fontSize: 13, color: "#64748b", marginBottom: 14 }}>
        建好马上就能在快速记录里点。
      </div>
      <Form
        form={form}
        layout="vertical"
        initialValues={{ 类型: defaultType, 计分制: defaultType === "表现" ? "加减分" : "过关" }}
        onFinish={handleFinish}
      >
        <Form.Item
          name="项目名"
          label="叫什么"
          rules={[{ required: true, message: "请输入项目名（如：跳绳达标、课堂发言）" }]}
        >
          <Input placeholder="比如：第四单元测 / 跳绳达标 / 课堂纪律" />
        </Form.Item>

        <Form.Item name="类型" label="类型" rules={[{ required: true }]}>
          <Select
            options={[
              { value: "学业", label: "学业" },
              { value: "表现", label: "表现" },
            ]}
            onChange={(val) => {
              if (val === "表现") {
                form.setFieldValue("计分制", "加减分");
              } else {
                form.setFieldValue("计分制", "过关");
              }
            }}
          />
        </Form.Item>

        <Form.Item
          noStyle
          shouldUpdate={(prev, cur) => prev.类型 !== cur.类型}
        >
          {({ getFieldValue }) => {
            const typeVal = getFieldValue("类型");
            const options =
              typeVal === "表现"
                ? [{ value: "加减分", label: "加减分" }]
                : [
                    { value: "过关", label: "过关" },
                    { value: "打钩", label: "打钩" },
                    { value: "等第", label: "等第" },
                    { value: "分数", label: "分数" },
                  ];
            return (
              <Form.Item name="计分制" label="怎么记" rules={[{ required: true }]}>
                <Select options={options} />
              </Form.Item>
            );
          }}
        </Form.Item>
      </Form>
    </AdaptiveModal>
  );
};

interface RenameItemModalProps {
  open: boolean;
  onClose: () => void;
  currentItemName: string;
  onRename: (newName: string) => Promise<void>;
}

export const RenameItemModal: React.FC<RenameItemModalProps> = ({
  open,
  onClose,
  currentItemName,
  onRename,
}) => {
  const [form] = Form.useForm();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ 新项目名: currentItemName });
    }
  }, [open, currentItemName, form]);

  const handleFinish = async (vals: { 新项目名: string }) => {
    await onRename(vals.新项目名);
  };

  return (
    <AdaptiveModal
      title="修改项目名称"
      open={open}
      onCancel={onClose}
      onOk={() => form.submit()}
      okText="保存"
    >
      <Form form={form} layout="vertical" onFinish={handleFinish}>
        <Form.Item
          name="新项目名"
          label="新项目名"
          rules={[{ required: true, message: "请输入新名称" }]}
        >
          <Input />
        </Form.Item>
      </Form>
    </AdaptiveModal>
  );
};
