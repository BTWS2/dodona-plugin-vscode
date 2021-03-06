import { Uri, window, workspace } from "vscode";
import * as path from "path";
import * as vscode from "vscode";
import * as fs from "fs";
import { getSyntax } from "../commentSyntax";
import { getAutoDescription } from "../configuration";
import { showActivityDescription } from "./showActivityDescription";
import Exercise from "../api/resources/activities/exercise";

/**
 * Action to create a new file for an exercise.
 *
 * @param exercise the exercise to create a file for
 */
export async function createNewExercise(exercise: Exercise) {
    // Find the active workspace.
    if (!workspace.rootPath) {
        const openButton = "Open Folder";
        window
            .showErrorMessage(
                "No active workspace found. Make sure you have opened a folder in Visual Studio Code and try again.",
                openButton,
            )
            .then(selection => {
                if (selection == openButton) {
                    // Configure dialogoptions so the user can't choose a file
                    // instead of a folder
                    const options: vscode.OpenDialogOptions = {
                        canSelectMany: false,
                        canSelectFolders: true,
                        canSelectFiles: false,
                    };

                    // Show a dialog where the user can choose a folder to open
                    vscode.window.showOpenDialog(options).then(folders => {
                        // Check if the user selected anything
                        if (folders != null && folders.length > 0) {
                            // Open the selected folder
                            vscode.commands.executeCommand(
                                "vscode.openFolder",
                                folders[0],
                            );
                        }
                    });
                }
            });
        return;
    }

    // Create a new file.
    const fileName = `${exercise.name}.${
        exercise.programming_language?.extension || "txt"
    }`;

    const filePath = path.join(workspace.rootPath, `${fileName}`);

    // Check if file already exists, if yes open that instead
    if (fs.existsSync(filePath)) {
        workspace
            .openTextDocument(path.join(workspace.rootPath, `${fileName}`))
            .then(document => {
                window.showTextDocument(document);
            });
        return;
    }

    const newFile = Uri.parse("untitled:" + filePath);

    // Open the created file.
    workspace
        .openTextDocument(newFile)
        .then(document => {
            window.showTextDocument(document, vscode.ViewColumn.One);
            // Build the file contents: the comment line and exercise boilerplate.
            const edit = new vscode.WorkspaceEdit();
            const commentedUrl = getSyntax(
                exercise.programming_language,
                removeJson(exercise.url),
            );
            const boilerplate =
                exercise.boilerplate != null ? exercise.boilerplate : "";

            // If the document is not empty, clear it
            if (document.getText()) {
                const message = `File ${fileName} already exists, and is not empty. Clicking "Confirm" will clear this document's contents, and replace it with the exercise's URL & boilerplate. Any changes made will be lost. Are you sure you want to continue?`;
                const confirm = "Confirm";
                const decline = "Decline";

                // Show a warning message asking for confirmation so the user doesn't
                // accidentally erase their file
                vscode.window
                    .showWarningMessage(message, confirm, decline)
                    .then(selection => {
                        if (selection == confirm) {
                            // Create the range here, so that the user can't add any new code
                            // inbetween calling this function & confirming, which could
                            // mess it up (not deleting everything, going out of range, ...)
                            const code = document.getText().split("\n");
                            const range = new vscode.Range(
                                0,
                                0,
                                code.length - 1,
                                code[code.length - 1].length,
                            );

                            // Delete the file content
                            edit.delete(newFile, range);
                            vscode.window.showInformationMessage(
                                `Cleared ${fileName}.`,
                            );

                            // Add the URL & boilerplate
                            edit.insert(
                                newFile,
                                new vscode.Position(0, 0),
                                `${commentedUrl}\n${boilerplate}`,
                            );
                            return applyEdit(edit);
                        }
                    });
            } else {
                // Add the URL & boilerplate
                edit.insert(
                    newFile,
                    new vscode.Position(0, 0),
                    `${commentedUrl}\n${boilerplate}`,
                );
                return applyEdit(edit);
            }
        })
        .then(() => {
            // Open the exercise if the user checked this option in the configuration.
            if (getAutoDescription()) {
                showActivityDescription(exercise);
            }
        });
}

async function applyEdit(edit: vscode.WorkspaceEdit): Promise<void> {
    // Insert the contents into the file.
    return workspace.applyEdit(edit).then(success => {
        if (!success) {
            window.showErrorMessage(
                "There was an error trying to add the boilerplate for this exercise.",
            );
        }
    });
}

/**
 * Removes the .json extension from the url.
 *
 * @param url the url to process
 */
function removeJson(url: string): string {
    if (url.endsWith(".json")) {
        url = url.slice(0, url.length - 5);
    }

    return url;
}
