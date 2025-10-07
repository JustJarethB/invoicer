import { Button } from "./Button"

export const Status = (props: Omit<Parameters<typeof Button>[0], 'classname' | "outline">) => {
    return <Button {...props} outline />
}