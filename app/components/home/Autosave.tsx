import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { type PropsWithChildren, useState } from "react";
import { TooltipWrapper } from "../Tooltip";
import { db } from "~/db";
import { formJson } from "~/utils/formJson";
import { eventBus } from "~/utils/events";
type Props = {
  name: string;
  hideIcon?: boolean;
  onChange?: (newState: Record<string, string>) => void;
};

export const Autosave = ({ children, hideIcon, name, onChange: onChangeParent }: PropsWithChildren<Props>) => {
  const [isSaving, setIsSaving] = useState(false);
  const onChange = async (e: React.ChangeEvent<HTMLFormElement>) => {
    const data: Record<string, string> = await formJson(e.currentTarget);
    onChangeParent?.(data);
    setIsSaving(true);
    try {
      await db.save([name], data);
    } catch (e) {
      eventBus.publish({
        type: "autosave.failed",
        severity: "warning",
        message: "Changes could not be saved automatically",
        context: { form: name, error: e instanceof Error ? e.message : String(e) },
      });
    } finally {
      setIsSaving(false);
    }
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
