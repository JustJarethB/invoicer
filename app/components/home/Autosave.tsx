import { ArrowPathIcon } from "@heroicons/react/16/solid";
import { type PropsWithChildren, useRef, useState } from "react";
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
  // onChange fires per keystroke, so a persistent save failure would publish
  // one warning per keystroke and churn the Toaster. Warn once per failure
  // streak; the next successful save re-arms the warning. Throttled at the
  // call site per the PR 51 ledger (G5a): the harness gains no coalescing
  // option, and one Autosave instance backs one form name.
  const failureWarned = useRef(false);
  const onChange = async (e: React.ChangeEvent<HTMLFormElement>) => {
    const data: Record<string, string> = await formJson(e.currentTarget);
    onChangeParent?.(data);
    setIsSaving(true);
    try {
      await db.save([name], data);
      failureWarned.current = false;
    } catch (e) {
      if (!failureWarned.current) {
        failureWarned.current = true;
        eventBus.publish({
          type: "autosave",
          severity: "warning",
          message: "Changes could not be saved automatically",
          context: { form: name, action: "failed", error: e },
        });
      }
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
