export const ButtonBar = ({ children }: { children: React.ReactNode }) => {
    return (
        <div className="flex flex-row-reverse justify-start gap-2 mt-2">
            {children}
        </div>
    );
}