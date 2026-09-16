import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { type PropsWithChildren, useState } from "react";
import { TooltipWrapper } from "../Tooltip";
import { db } from "~/db";
import { formJson } from "~/utils/formJson";

/** The domain keys Autosave may persist to; each has a schema in ~/data/schemas. */
export type AutosaveDomain = "from-address" | "payment-details" | "logo";

type Props = {
  name: AutosaveDomain;
  hideIcon?: boolean;
  onChange?: (newState: Record<string, string>) => void;
};

export const Autosave = ({ children, hideIcon, name, onChange: onChangeParent }: PropsWithChildren<Props>) => {
  const [isSaving, setIsSaving] = useState(false);
  const onChange = async (e: React.ChangeEvent<HTMLFormElement>) => {
    const data: Record<string, string> = await formJson(e.currentTarget);
    onChangeParent?.(data);
    setIsSaving(true);
    await db.saveForm(name, data);
    setIsSaving(false);
  };
  return (
    <form onChange={onChange} className="relative">
      <span className={`${hideIcon && "hidden"} absolute top-1 right-1 print:hidden`}>
        <TooltipWrapper tooltip="These values are stored locally for next time">
          <ArrowPathIcon
            className={`${isSaving ? "text-amber-400 animate-spin" : "text-blue-400"} opacity-50 transition-transform delay-300 h-5 w-5 cursor-help`}
          />
        </TooltipWrapper>
      </span>
      {children}
    </form>
  );
};
