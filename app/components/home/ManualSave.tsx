import { ArrowPathRoundedSquareIcon } from "@heroicons/react/16/solid";
import { useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import { TooltipWrapper } from "../Tooltip";
import { formJson } from "../../utils/formJson";

type Props = {
  hideIcon?: boolean;
  onChange?: (record: Record<string, string>) => void;
  /**
   * Called when the user clicks the save icon with the current form record.
   * Return the confirmation UI (e.g. a modal) to render, or null to render
   * nothing. The caller decides what "save" means and what extra data (if any)
   * the confirmation gathers. This is the user-facing difference from Autosave:
   * the save is a deliberate click, not on every change.
   */
  onSave?: (record: Record<string, string>, close: () => void) => ReactNode;
};

/**
 * Wraps a form and tracks staleness, exposing a manual save affordance via
 * `onSave`. Generic over the form's shape — it only knows records, never a
 * specific domain type. Use for any form that should persist on click rather
 * than on change.
 */
export const ManualSave = ({ children, hideIcon, onChange: onChangeParent, onSave }: PropsWithChildren<Props>) => {
  const formRef = useRef<HTMLFormElement>(null);
  const [isStale, setIsStale] = useState(false);
  const [confirmation, setConfirmation] = useState<ReactNode>(null);

  const closeConfirmation = () => setConfirmation(null);

  const onChange = async () => {
    setIsStale(true);
    if (!formRef.current) return;
    onChangeParent?.(await formJson(formRef.current));
  };
  const handleSave = async () => {
    if (!formRef.current || !onSave) return;
    setConfirmation(onSave(await formJson(formRef.current), closeConfirmation));
  };
  return (
    <>
      <form ref={formRef} onChange={onChange} className="relative">
        <span className={`${hideIcon && "hidden"} absolute top-1 right-1 print:hidden`}>
          <TooltipWrapper tooltip="Save these values for later">
            <ArrowPathRoundedSquareIcon
              onClick={handleSave}
              className={`${isStale ? "text-amber-400" : "text-blue-400 rotate-180 opacity-50"} transition-all duration-300 h-5 w-5 cursor-pointer`}
            />
          </TooltipWrapper>
        </span>
        {children}
      </form>
      {confirmation}
    </>
  );
};
