import { useEffect, useMemo, useState } from "react";
import { Modal } from "./Modal";
import { Button } from "./home/Button";
import { ButtonBar } from "./ButtonBar";
import { db } from "~/db";

export const TutorialWizard = () => {
    const [showTutorial, setShowTutorial] = useState(false);
    const [stage, setStage] = useState(0);
    //  TODO: Uncomment this when you want to enable the tutorial again
    // useEffect(() => {
    //     db.get(['showTutorial']).then((value) => {
    //         setShowTutorial(value !== false);
    //     })
    // }, [])
    const closeTutorial = () => setShowTutorial(false);

    const finishTutorial = () => {
        closeTutorial()
        db.save(['showTutorial'], false);
    }
    const nextStage = useMemo(() => () => setStage((prev) => prev + 1), [setStage]);
    const prevStage = useMemo(() => () => setStage((prev) => prev - 1), [setStage]);
    if (!showTutorial) return null
    return getStageContent({ stage, closeTutorial, nextStage, prevStage, finishTutorial })
}

type StageContentProps = {
    stage: number;
    closeTutorial: () => void;
    nextStage: () => void;
    prevStage: () => void;
    finishTutorial: () => void;
};

// TODO: probably want to do dark/blur background with cutout indicating the focus area, maybe with a ring around it
const getStageContent = ({ stage, closeTutorial, nextStage, prevStage, finishTutorial }: StageContentProps) => {
    switch (stage) {
        case 0:
            return <Modal title="Need a hand?" onClose={finishTutorial}>
                <div className="flex flex-col gap-4">
                    <p className="text-gray-700 dark:text-gray-300">Welcome to the app! If you need help getting started, we can guide you through the basics.</p>
                    <p className="text-xs text-gray-700 dark:text-gray-300">We won't ask again, but you can always change your mind in the settings!</p>
                    <ButtonBar>
                        <Button
                            color="info"
                            onClick={nextStage}
                        >
                            Start Tutorial
                        </Button>
                        <Button
                            onClick={finishTutorial}
                        >
                            Maybe later
                        </Button>
                    </ButtonBar>
                </div>
            </Modal>
        case 1:
            return <Modal title="Great choice!" onClose={closeTutorial}>
                <div className="flex flex-col gap-4">
                    <p className="text-gray-700 dark:text-gray-300">We'll only take a minute to show you the need-to-knows of the app; The ethos of this project is to get you on the ground and running without the bloat. You can use your keyboard to navigate the tutorial, you'll see why that's good to know in a moment...</p>
                    <ButtonBar>
                        <Button
                            color="info"
                            onClick={nextStage}
                        >
                            Next
                        </Button>
                        <Button
                            onClick={prevStage}
                        >
                            Back
                        </Button>
                    </ButtonBar>
                </div>
            </Modal>
        case 2: // Overall Invoice: WYSIWYG. Click anywhere to edit, click the top right to save.
        case 7: // Logo
        case 3: // Auto-save: The app saves your changes automatically, so you can focus on your work without worrying about losing anything. (locally)
        case 8: // Invoice Meta - prefilled
        case 9: // From / To
        case 4: // Manual Save: This icon indicates a manual save option, which allows you to save your changes at any time. 
        case 4.5: // Clients list - side menu and auto-fill
        case 10: // Line Items
        case 5: // Info Icons: We've tried to keep things as clean as possible, but sometimes you might need a little extra help. If you see an info icon, hover over it to get more information about that feature. You can turn these off in the settings menu
        case 11: // Explain Line Item Type / maybe highlight totals
        case 6: // Settings: The settings menu is where you can customize the app to your liking. You can change the theme, turn off info icons, and more.
        default:
            return <Modal title="We're Lost!" onClose={closeTutorial}>
                <div className="">
                    <p className="text-gray-700 dark:text-gray-300">This is embarassing, but you shouldn't be able to see this. It looks like you've been sent down the wrong path. Please try again, and let us know if this keeps happening!</p>
                    <ButtonBar>
                        <Button
                            color="danger"
                            onClick={closeTutorial}
                        >
                            Abort Tutorial
                        </Button>
                    </ButtonBar>
                </div>
            </Modal>
    }
}