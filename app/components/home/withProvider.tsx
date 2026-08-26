import type { ReactNode } from "react";

export const withProvider = (Provider: React.ComponentType<{ children: ReactNode; }>) => <P extends object>(Component: React.ComponentType<P>) => {
    return function WrappedComponent(props: P) {
        return (
            <Provider>
                <Component {...props} />
            </Provider>
        );
    };
}
