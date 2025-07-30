import { Button } from "./Button"

export const Status = (props: Omit<Parameters<typeof Button>[0], 'classname' | "outline" | "onClick">) => {
    return <Button {...props} outline className="pointer-events-none" />
}