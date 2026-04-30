import { KeyboardEvent, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { profileApi, storeApi } from "../services/api";
import { useAuthStore } from "../store/authStore";

type MultiValue = {
  selected: string[];
  custom: string[];
};

type SingleValue = {
  selected: string;
  custom: string;
};

type ProfileFormState = {
  customerGroups: MultiValue;
  priceRange: SingleValue;
  consumptionScenarios: MultiValue;
  storeStyles: MultiValue;
  desiredFeelings: MultiValue;
  differentiators: MultiValue;
  customerDescriptions: MultiValue;
  photogenicLevel: SingleValue;
  emotionTags: MultiValue;
  fitScenarios: MultiValue;
};

type MultiFieldKey = keyof Pick<
  ProfileFormState,
  | "customerGroups"
  | "consumptionScenarios"
  | "storeStyles"
  | "desiredFeelings"
  | "differentiators"
  | "customerDescriptions"
  | "emotionTags"
  | "fitScenarios"
>;

type BasicFieldConfig = {
  label: string;
  guide: string;
  example: string;
  allowCustom: boolean;
};

type BasicMultiFieldConfig = BasicFieldConfig & {
  key: "customerGroups" | "consumptionScenarios" | "storeStyles";
  options: readonly string[];
  selectionType: "multi";
};

type BasicSingleFieldConfig = BasicFieldConfig & {
  key: "priceRange";
  options: readonly string[];
  selectionType: "single";
};

type QuestionStepConfig = {
  key: MultiFieldKey;
  title: string;
  guide: string;
  example: string;
  options: string[];
};

const basicFields: Array<BasicMultiFieldConfig | BasicSingleFieldConfig> = [
  {
    key: "customerGroups",
    label: "客群",
    selectionType: "multi",
    options: ["学生", "白领", "家庭", "情侣"],
    allowCustom: true,
    guide: "选择店铺核心服务的客群，可多选，也可自定义补充。",
    example: "示例：学生、情侣、写字楼周边上班族"
  },
  {
    key: "priceRange",
    label: "客单价",
    selectionType: "single",
    options: ["20以下", "20-50", "50-100", "100+"],
    allowCustom: true,
    guide: "选择店铺人均消费区间，单选；如预设不匹配，可选择“其他”后填写。",
    example: "示例：工作日午餐 25-35，晚餐 45-60"
  },
  {
    key: "consumptionScenarios",
    label: "消费场景",
    selectionType: "multi",
    options: ["快餐", "社交", "约会", "打卡", "深夜"],
    allowCustom: true,
    guide: "选择店铺核心适配的消费场景，可多选，也可自定义补充。",
    example: "示例：工作餐、夜宵、聚会小酌"
  },
  {
    key: "storeStyles",
    label: "店铺风格",
    selectionType: "multi",
    options: ["治愈", "高级", "烟火气", "极简", "网红"],
    allowCustom: true,
    guide: "选择店铺核心风格，可多选，也可自定义补充。",
    example: "示例：治愈、烟火气、复古、社区友好"
  }
];

const coreQuestionSteps: QuestionStepConfig[] = [
  {
    key: "desiredFeelings",
    title: "Q4：你的店最想给人什么感觉？",
    guide: "定义店铺品牌人格核心，可多选预设标签，也可补充个性化描述。",
    options: ["像回家一样", "精致但不贵", "温暖放松", "性价比拉满", "小众有格调"],
    example: "示例：像回家一样、温暖放松、社区熟客都愿意常来"
  },
  {
    key: "differentiators",
    title: "Q5：顾客为什么会选择你，而不是别家？",
    guide: "明确店铺最核心的差异化竞争力，可多选并补充自定义优势。",
    options: ["更实在", "味道更浓", "食材更新鲜", "性价比更高", "环境更舒服"],
    example: "示例：更实在、出餐稳定、食材更新鲜"
  },
  {
    key: "customerDescriptions",
    title: "Q6：你希望顾客怎么描述你的店？",
    guide: "定义对外传播语气和理想口碑方向，可多选并补充自定义说法。",
    options: ["很有人情味", "很适合拍照", "好吃不踩雷", "氛围感拉满", "老板超nice"],
    example: "示例：很有人情味、好吃不踩雷、老板很热情"
  }
];

const propagationOptions = {
  photogenic: ["是", "一般", "否"],
  emotions: ["治愈", "快乐", "解压", "高级", "孤独"]
} as const;

const fitScenarioOptions = ["深夜加班", "周末放松", "朋友小聚", "情侣约会", "一人食", "家庭聚餐"];

const stepTitles = ["基础属性", "品牌核心 1", "品牌核心 2", "品牌核心 3", "传播属性", "场景延伸"];

const emptyMultiValue = (): MultiValue => ({ selected: [], custom: [] });

const emptySingleValue = (): SingleValue => ({ selected: "", custom: "" });

const createEmptyForm = (): ProfileFormState => ({
  customerGroups: emptyMultiValue(),
  priceRange: emptySingleValue(),
  consumptionScenarios: emptyMultiValue(),
  storeStyles: emptyMultiValue(),
  desiredFeelings: emptyMultiValue(),
  differentiators: emptyMultiValue(),
  customerDescriptions: emptyMultiValue(),
  photogenicLevel: emptySingleValue(),
  emotionTags: emptyMultiValue(),
  fitScenarios: emptyMultiValue()
});

const createEmptyDrafts = (): Record<MultiFieldKey, string> => ({
  customerGroups: "",
  consumptionScenarios: "",
  storeStyles: "",
  desiredFeelings: "",
  differentiators: "",
  customerDescriptions: "",
  emotionTags: "",
  fitScenarios: ""
});

const dedupeItems = (items: string[]) => Array.from(new Set(items.map((item) => item.trim()).filter(Boolean)));

const splitCustomInput = (value: string) => dedupeItems(value.split(/[\n,，、]/).map((item) => item.trim()));

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeMultiValue = (value: unknown, presetOptions: readonly string[]): MultiValue => {
  const selected: string[] = [];
  const custom: string[] = [];

  const pushItem = (item: string) => {
    if (!item.trim()) {
      return;
    }
    if (presetOptions.includes(item.trim())) {
      selected.push(item.trim());
    } else {
      custom.push(item.trim());
    }
  };

  if (typeof value === "string") {
    splitCustomInput(value).forEach(pushItem);
  } else if (Array.isArray(value)) {
    value.forEach((item) => pushItem(String(item)));
  } else if (isRecord(value)) {
    const rawSelected = value.selected;
    const rawCustom = value.custom;

    if (typeof rawSelected === "string") {
      pushItem(rawSelected);
    } else if (Array.isArray(rawSelected)) {
      rawSelected.forEach((item) => pushItem(String(item)));
    }

    if (typeof rawCustom === "string") {
      splitCustomInput(rawCustom).forEach((item) => custom.push(item));
    } else if (Array.isArray(rawCustom)) {
      rawCustom.forEach((item) => splitCustomInput(String(item)).forEach((parsed) => custom.push(parsed)));
    }
  }

  return { selected: dedupeItems(selected), custom: dedupeItems(custom) };
};

const normalizeSingleValue = (value: unknown, presetOptions: readonly string[], allowCustom: boolean): SingleValue => {
  let selected = "";
  let custom = "";

  const assignValue = (item: string) => {
    const normalized = item.trim();
    if (!normalized) {
      return;
    }
    if (presetOptions.includes(normalized)) {
      selected = normalized;
      custom = "";
      return;
    }
    if (allowCustom) {
      selected = "其他";
      custom = normalized;
    }
  };

  if (typeof value === "string") {
    assignValue(value);
  } else if (Array.isArray(value) && value.length > 0) {
    assignValue(String(value[0]));
  } else if (isRecord(value)) {
    const rawSelected = typeof value.selected === "string" ? value.selected.trim() : "";
    const rawCustom =
      typeof value.custom === "string"
        ? value.custom.trim()
        : Array.isArray(value.custom)
          ? String(value.custom[0] ?? "").trim()
          : "";

    if (rawSelected && presetOptions.includes(rawSelected)) {
      selected = rawSelected;
      custom = "";
    } else if (allowCustom && (rawCustom || rawSelected)) {
      selected = "其他";
      custom = rawCustom || rawSelected;
    }
  }

  return { selected, custom };
};

const normalizeProfileForm = (rawAnswers: Record<string, unknown> | undefined): ProfileFormState => {
  const answers = rawAnswers ?? {};
  const legacyRestaurantStyle = answers.restaurant_style;
  const legacySignatureFocus = answers.signature_focus;
  const legacyTargetCustomers = answers.target_customers;
  const legacyDesiredFeeling = answers.desired_feeling;
  const legacyTonePreference = answers.tone_preference;

  return {
    customerGroups: normalizeMultiValue(answers.customer_groups ?? legacyTargetCustomers, basicFields[0].options),
    priceRange: normalizeSingleValue(answers.price_range, basicFields[1].options, true),
    consumptionScenarios: normalizeMultiValue(answers.consumption_scenarios, basicFields[2].options),
    storeStyles: normalizeMultiValue(answers.store_styles ?? legacyRestaurantStyle, basicFields[3].options),
    desiredFeelings: normalizeMultiValue(answers.desired_feelings ?? legacyDesiredFeeling, coreQuestionSteps[0].options),
    differentiators: normalizeMultiValue(answers.differentiators ?? legacySignatureFocus, coreQuestionSteps[1].options),
    customerDescriptions: normalizeMultiValue(answers.customer_descriptions ?? legacyTonePreference, coreQuestionSteps[2].options),
    photogenicLevel: normalizeSingleValue(answers.photogenic_level, propagationOptions.photogenic, false),
    emotionTags: normalizeMultiValue(answers.emotion_tags, propagationOptions.emotions),
    fitScenarios: normalizeMultiValue(answers.fit_scenarios, fitScenarioOptions)
  };
};

const getMultiDisplayValues = (value: MultiValue) => dedupeItems([...value.selected, ...value.custom]);

const getSingleDisplayValue = (value: SingleValue) => (value.selected === "其他" ? value.custom.trim() : value.selected.trim());

const isMultiFilled = (value: MultiValue) => getMultiDisplayValues(value).length > 0;

const isSingleFilled = (value: SingleValue) => Boolean(getSingleDisplayValue(value));

function TagButton({ label, selected, onClick }: { label: string; selected: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`tag-button ${selected ? "selected" : ""}`} onClick={onClick}>
      {label}
    </button>
  );
}

function MultiSelectField(props: {
  label: string;
  guide: string;
  example: string;
  options: readonly string[];
  value: MultiValue;
  draft: string;
  onTogglePreset: (option: string) => void;
  onDraftChange: (value: string) => void;
  onAddCustom: () => void;
  onRemoveCustom: (item: string) => void;
}) {
  const { label, guide, example, options, value, draft, onTogglePreset, onDraftChange, onAddCustom, onRemoveCustom } = props;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      onAddCustom();
    }
  };

  return (
    <div className="stack profile-field-block">
      <div className="field-heading">
        <strong>{label}</strong>
        <div className="muted">{guide}</div>
        <div className="helper-text">{example}</div>
      </div>
      <div className="tag-group">
        {options.map((option) => (
          <TagButton key={option} label={option} selected={value.selected.includes(option)} onClick={() => onTogglePreset(option)} />
        ))}
      </div>
      <div className="field inline-field">
        <input
          value={draft}
          placeholder="输入自定义补充，多个内容可用逗号分隔"
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="button" className="button secondary" onClick={onAddCustom}>
          添加
        </button>
      </div>
      {value.custom.length > 0 && (
        <div className="tag-group">
          {value.custom.map((item) => (
            <button key={item} type="button" className="tag-button custom-tag selected" onClick={() => onRemoveCustom(item)}>
              {item} ×
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function SingleSelectField(props: {
  label: string;
  guide: string;
  example: string;
  options: readonly string[];
  value: SingleValue;
  allowCustom: boolean;
  customPlaceholder: string;
  onSelect: (option: string) => void;
  onCustomChange: (value: string) => void;
}) {
  const { label, guide, example, options, value, allowCustom, customPlaceholder, onSelect, onCustomChange } = props;

  return (
    <div className="stack profile-field-block">
      <div className="field-heading">
        <strong>{label}</strong>
        <div className="muted">{guide}</div>
        <div className="helper-text">{example}</div>
      </div>
      <div className="tag-group">
        {options.map((option) => (
          <TagButton key={option} label={option} selected={value.selected === option} onClick={() => onSelect(option)} />
        ))}
        {allowCustom && <TagButton label="其他" selected={value.selected === "其他"} onClick={() => onSelect("其他")} />}
      </div>
      {allowCustom && value.selected === "其他" && (
        <div className="field">
          <input
            value={value.custom}
            placeholder={customPlaceholder}
            onChange={(event) => onCustomChange(event.target.value)}
          />
        </div>
      )}
    </div>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { storeId = "" } = useParams();
  const setCurrentStore = useAuthStore((state) => state.setCurrentStore);
  const numericStoreId = Number(storeId);
  const { data: store } = useQuery({
    queryKey: ["store", numericStoreId],
    queryFn: () => storeApi.get(numericStoreId)
  });
  const { data: profile } = useQuery({
    queryKey: ["profile", numericStoreId],
    queryFn: () => profileApi.get(numericStoreId),
    retry: false
  });
  const [stepIndex, setStepIndex] = useState(0);
  const [form, setForm] = useState<ProfileFormState>(createEmptyForm);
  const [drafts, setDrafts] = useState<Record<MultiFieldKey, string>>(createEmptyDrafts);

  const saveMutation = useMutation({
    mutationFn: () =>
      profileApi.upsert(numericStoreId, {
        customer_groups: form.customerGroups,
        price_range: form.priceRange,
        consumption_scenarios: form.consumptionScenarios,
        store_styles: form.storeStyles,
        desired_feelings: form.desiredFeelings,
        differentiators: form.differentiators,
        customer_descriptions: form.customerDescriptions,
        photogenic_level: form.photogenicLevel,
        emotion_tags: form.emotionTags,
        fit_scenarios: form.fitScenarios
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", numericStoreId] });
      navigate(`/stores/${numericStoreId}`);
    }
  });
  const skipMutation = useMutation({
    mutationFn: () => profileApi.skip(numericStoreId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["profile", numericStoreId] });
      navigate(`/stores/${numericStoreId}`);
    }
  });

  useEffect(() => {
    if (store) {
      setCurrentStore(store);
    }
  }, [setCurrentStore, store]);

  useEffect(() => {
    setForm(normalizeProfileForm(profile?.answers_json as Record<string, unknown> | undefined));
    setDrafts(createEmptyDrafts());
    setStepIndex(0);
  }, [profile]);

  const stepCompletion = useMemo(
    () => [
      isMultiFilled(form.customerGroups) &&
        isSingleFilled(form.priceRange) &&
        isMultiFilled(form.consumptionScenarios) &&
        isMultiFilled(form.storeStyles),
      isMultiFilled(form.desiredFeelings),
      isMultiFilled(form.differentiators),
      isMultiFilled(form.customerDescriptions),
      isSingleFilled(form.photogenicLevel) && isMultiFilled(form.emotionTags),
      isMultiFilled(form.fitScenarios)
    ],
    [form]
  );

  const completedFieldCount = useMemo(() => {
    const allChecks = [
      isMultiFilled(form.customerGroups),
      isSingleFilled(form.priceRange),
      isMultiFilled(form.consumptionScenarios),
      isMultiFilled(form.storeStyles),
      isMultiFilled(form.desiredFeelings),
      isMultiFilled(form.differentiators),
      isMultiFilled(form.customerDescriptions),
      isSingleFilled(form.photogenicLevel),
      isMultiFilled(form.emotionTags),
      isMultiFilled(form.fitScenarios)
    ];
    return allChecks.filter(Boolean).length;
  }, [form]);

  const currentStepComplete = stepCompletion[stepIndex];

  const toggleMultiPreset = (key: MultiFieldKey, option: string) => {
    setForm((current) => {
      const currentValue = current[key];
      const exists = currentValue.selected.includes(option);
      return {
        ...current,
        [key]: {
          ...currentValue,
          selected: exists ? currentValue.selected.filter((item) => item !== option) : [...currentValue.selected, option]
        }
      };
    });
  };

  const addCustomItems = (key: MultiFieldKey) => {
    const parsed = splitCustomInput(drafts[key]);
    if (parsed.length === 0) {
      return;
    }
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        custom: dedupeItems([...current[key].custom, ...parsed])
      }
    }));
    setDrafts((current) => ({ ...current, [key]: "" }));
  };

  const removeCustomItem = (key: MultiFieldKey, item: string) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        custom: current[key].custom.filter((currentItem) => currentItem !== item)
      }
    }));
  };

  const setSingleOption = (key: "priceRange" | "photogenicLevel", option: string) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        selected: option,
        custom: option === "其他" ? current[key].custom : ""
      }
    }));
  };

  const setSingleCustom = (key: "priceRange" | "photogenicLevel", value: string) => {
    setForm((current) => ({
      ...current,
      [key]: {
        ...current[key],
        selected: "其他",
        custom: value
      }
    }));
  };

  const renderQuestionStep = (config: QuestionStepConfig) => (
    <section className="stack">
      <div className="step-hero">
        <span className="step-badge">单题引导</span>
        <h3>{config.title}</h3>
        <p className="muted">{config.guide}</p>
        <div className="helper-text">{config.example}</div>
      </div>
      <MultiSelectField
        label="可选标签"
        guide="先点选最接近的预设标签，再补充你自己的表达。"
        example={config.example}
        options={config.options}
        value={form[config.key]}
        draft={drafts[config.key]}
        onTogglePreset={(option) => toggleMultiPreset(config.key, option)}
        onDraftChange={(value) => setDrafts((current) => ({ ...current, [config.key]: value }))}
        onAddCustom={() => addCustomItems(config.key)}
        onRemoveCustom={(item) => removeCustomItem(config.key, item)}
      />
    </section>
  );

  const draftPreviewSections = [
    { label: "客群", values: getMultiDisplayValues(form.customerGroups) },
    { label: "客单价", values: [getSingleDisplayValue(form.priceRange)].filter(Boolean) },
    { label: "消费场景", values: getMultiDisplayValues(form.consumptionScenarios) },
    { label: "店铺风格", values: getMultiDisplayValues(form.storeStyles) },
    { label: "最想传递的感觉", values: getMultiDisplayValues(form.desiredFeelings) },
    { label: "顾客选择本店的原因", values: getMultiDisplayValues(form.differentiators) },
    { label: "希望顾客如何描述本店", values: getMultiDisplayValues(form.customerDescriptions) },
    { label: "是否适合拍照", values: [getSingleDisplayValue(form.photogenicLevel)].filter(Boolean) },
    { label: "店铺情绪标签", values: getMultiDisplayValues(form.emotionTags) },
    { label: "更适合的场景", values: getMultiDisplayValues(form.fitScenarios) }
  ];

  const renderCurrentStep = () => {
    if (stepIndex === 0) {
      return (
        <section className="stack">
          <div className="step-hero">
            <span className="step-badge">模块 1</span>
            <h3>店铺基础标签</h3>
            <p className="muted">先用结构化标签快速定义店铺画像，减少从零输入的压力。</p>
          </div>
          {basicFields.map((field) =>
            field.selectionType === "multi" ? (
              <MultiSelectField
                key={field.key}
                label={field.label}
                guide={field.guide}
                example={field.example}
                options={field.options}
                value={form[field.key]}
                draft={drafts[field.key]}
                onTogglePreset={(option) => toggleMultiPreset(field.key, option)}
                onDraftChange={(value) => setDrafts((current) => ({ ...current, [field.key]: value }))}
                onAddCustom={() => addCustomItems(field.key)}
                onRemoveCustom={(item) => removeCustomItem(field.key, item)}
              />
            ) : (
              <SingleSelectField
                key="priceRange"
                label={field.label}
                guide={field.guide}
                example={field.example}
                options={field.options}
                value={form.priceRange}
                allowCustom={field.allowCustom}
                customPlaceholder="输入自定义客单价区间"
                onSelect={(option) => setSingleOption("priceRange", option)}
                onCustomChange={(value) => setSingleCustom("priceRange", value)}
              />
            )
          )}
        </section>
      );
    }

    if (stepIndex >= 1 && stepIndex <= 3) {
      return renderQuestionStep(coreQuestionSteps[stepIndex - 1]);
    }

    if (stepIndex === 4) {
      return (
        <section className="stack">
          <div className="step-hero">
            <span className="step-badge">模块 3</span>
            <h3>传播属性标签</h3>
            <p className="muted">继续补充拍照属性和情绪价值，帮助后续生成更像你店铺的传播表达。</p>
          </div>
          <SingleSelectField
            label="是否适合拍照"
            guide="选择店铺是否具备拍照出片的属性，单选。"
            example="示例：适合拍照的店，通常空间、摆盘或灯光更容易出片。"
            options={propagationOptions.photogenic}
            value={form.photogenicLevel}
            allowCustom={false}
            customPlaceholder=""
            onSelect={(option) => setSingleOption("photogenicLevel", option)}
            onCustomChange={() => undefined}
          />
          <MultiSelectField
            label="店铺情绪标签"
            guide="选择店铺能给用户带来的核心情绪价值，可多选，也可自定义补充。"
            example="示例：治愈、快乐、解压、轻松松弛"
            options={[...propagationOptions.emotions]}
            value={form.emotionTags}
            draft={drafts.emotionTags}
            onTogglePreset={(option) => toggleMultiPreset("emotionTags", option)}
            onDraftChange={(value) => setDrafts((current) => ({ ...current, emotionTags: value }))}
            onAddCustom={() => addCustomItems("emotionTags")}
            onRemoveCustom={(item) => removeCustomItem("emotionTags", item)}
          />
        </section>
      );
    }

    return (
      <section className="stack">
        <div className="step-hero">
          <span className="step-badge">模块 4</span>
          <h3>Q7：本店 / 菜品更适合什么场景？</h3>
          <p className="muted">用于后续店铺文案的场景化代入，提升内容传播力。</p>
          <div className="helper-text">示例：深夜加班、朋友小聚、情侣约会、一人食、家庭聚餐</div>
        </div>
        <MultiSelectField
          label="适配场景"
          guide="可多选预设标签，也支持自定义输入多个补充场景。"
          example="示例：周末放松、朋友小聚、下班犒劳自己"
          options={fitScenarioOptions}
          value={form.fitScenarios}
          draft={drafts.fitScenarios}
          onTogglePreset={(option) => toggleMultiPreset("fitScenarios", option)}
          onDraftChange={(value) => setDrafts((current) => ({ ...current, fitScenarios: value }))}
          onAddCustom={() => addCustomItems("fitScenarios")}
          onRemoveCustom={(item) => removeCustomItem("fitScenarios", item)}
        />
      </section>
    );
  };

  return (
    <div className="grid two">
      <section className="card stack">
        <div className="stack" style={{ gap: 8 }}>
          <h2>店铺风格档案</h2>
          <p className="muted">按“基础属性 → 品牌核心 → 传播属性 → 场景延伸”逐步填写，完成后会自动生成结构化档案摘要。</p>
          <div className="step-indicator-grid">
            {stepTitles.map((title, index) => (
              <div key={title} className={`step-indicator-item ${index === stepIndex ? "active" : ""} ${stepCompletion[index] ? "done" : ""}`}>
                <span>{index + 1}</span>
                <strong>{title}</strong>
              </div>
            ))}
          </div>
        </div>

        {renderCurrentStep()}

        {!currentStepComplete && (
          <div className="notice-box">
            当前步骤还有必填内容未完成，补齐后才可以继续下一步。
          </div>
        )}

        <div className="button-row">
          <button className="button secondary" type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => current - 1)}>
            上一步
          </button>
          {stepIndex < stepTitles.length - 1 ? (
            <button className="button" type="button" disabled={!currentStepComplete} onClick={() => setStepIndex((current) => current + 1)}>
              下一步
            </button>
          ) : (
            <button className="button" type="button" disabled={!currentStepComplete || saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "保存中..." : "完成并生成档案"}
            </button>
          )}
          <button className="button secondary" type="button" onClick={() => skipMutation.mutate()} disabled={skipMutation.isPending}>
            跳过
          </button>
        </div>
      </section>

      <section className="card stack">
        <h2>档案预览</h2>
        <div className="muted">已完成 {completedFieldCount} / 10 项，右侧预览会随你的选择即时更新。</div>
        <div className="stack summary-section">
          {draftPreviewSections.map((section) => (
            <div key={section.label} className="summary-row">
              <strong>{section.label}</strong>
              {section.values.length > 0 ? (
                <div className="tag-group">
                  {section.values.map((value) => (
                    <span key={value} className="pill">
                      {value}
                    </span>
                  ))}
                </div>
              ) : (
                <div className="muted">待填写</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
