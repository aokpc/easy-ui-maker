import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let outputChannel: vscode.OutputChannel | undefined;

export class HtmlPreviewPanel {
    public static currentPanel: HtmlPreviewPanel | undefined;
    private readonly _panel: vscode.WebviewPanel;
    private _disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel, extensionPath: string) {
        this._panel = panel;

        // Create output channel if not exists
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('Arduino UI Preview');
        }

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            (message) => {
                // VS Code APIからのメッセージをラップ
                const data = message.data || message;
                
                if (data.type === 'console') {
                    this.handleConsoleMessage(data);
                } else if (message.command === 'vscode') {
                    // VS Code API経由のメッセージ
                    if (message.data.type === 'console') {
                        this.handleConsoleMessage(message.data);
                    }
                }
            },
            null,
            this._disposables
        );

        // Handle when the panel is disposed
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    private handleConsoleMessage(message: any) {
        if (!outputChannel) return;

        const timestamp = new Date().toLocaleTimeString();
        const level = message.level || 'log';
        const levelMap: Record<string, string> = {
            'log': '[L]',
            'error': '[E]',
            'warn': '[W]',
            'info': '[I]',
            'arduino': '[A]'
        };
        const levelIcon = levelMap[level] || '[L]';

        const output = `${timestamp} ${levelIcon} ${message.message}`;
        outputChannel.appendLine(output);
        outputChannel.show(true);
    }

    public static createOrShow(extensionPath: string, htmlPath: string) {
        const column = vscode.ViewColumn.Beside;

        // If we already have a panel, show it
        if (HtmlPreviewPanel.currentPanel) {
            HtmlPreviewPanel.currentPanel._panel.reveal(column);
            HtmlPreviewPanel.currentPanel.updateContent(htmlPath);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            'htmlPreview',
            'HTML Preview',
            column,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.file(path.dirname(htmlPath))]
            }
        );

        HtmlPreviewPanel.currentPanel = new HtmlPreviewPanel(panel, extensionPath);
        HtmlPreviewPanel.currentPanel.updateContent(htmlPath);
    }

    private updateContent(htmlPath: string) {
        if (!fs.existsSync(htmlPath)) {
            this._panel.webview.html = '<h1>HTML file not found</h1>';
            return;
        }

        try {
            let htmlContent = fs.readFileSync(htmlPath, 'utf8');

            // </body>の直前にWebview API登録スクリプトを挿入
            const vsCodeApiScript = `<script>
// VS Code Webview API
if (typeof acquireVsCodeApi === 'undefined') {
    window.acquireVsCodeApi = function() {
        const messageId = Math.random();
        return {
            postMessage: (message) => {
                window.parent.postMessage({ 
                    command: 'vscode',
                    id: messageId,
                    data: message 
                }, '*');
            }
        };
    };
}
</script>`;

            if (htmlContent.includes('</body>')) {
                htmlContent = htmlContent.replace('</body>', vsCodeApiScript + '\n</body>');
            } else {
                htmlContent = htmlContent + vsCodeApiScript;
            }

            // Replace relative paths with webview URIs
            const folderPath = path.dirname(htmlPath);
            
            // Replace CSS file references
            htmlContent = htmlContent.replace(
                /href="([^"]+\.css)"/g,
                (match, filePath: string) => {
                    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('/')) {
                        return match;
                    }
                    const fullPath = path.join(folderPath, filePath);
                    const uri = this._panel.webview.asWebviewUri(vscode.Uri.file(fullPath));
                    return `href="${uri}"`;
                }
            );

            // Replace script file references
            htmlContent = htmlContent.replace(
                /src="([^"]+\.js)"/g,
                (match, filePath: string) => {
                    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('/')) {
                        return match;
                    }
                    const fullPath = path.join(folderPath, filePath);
                    const uri = this._panel.webview.asWebviewUri(vscode.Uri.file(fullPath));
                    return `src="${uri}"`;
                }
            );

            // Replace image file references
            htmlContent = htmlContent.replace(
                /src="([^"]+\.(png|jpg|jpeg|gif|svg))"(?=[^>]*>(?!.*<script))/gi,
                (match, filePath: string) => {
                    if (filePath.startsWith('http://') || filePath.startsWith('https://') || filePath.startsWith('/')) {
                        return match;
                    }
                    const fullPath = path.join(folderPath, filePath);
                    if (fs.existsSync(fullPath)) {
                        const uri = this._panel.webview.asWebviewUri(vscode.Uri.file(fullPath));
                        return `src="${uri}"`;
                    }
                    return match;
                }
            );

            this._panel.webview.html = htmlContent;
        } catch (error) {
            this._panel.webview.html = `<h1>Error loading HTML</h1><p>${error}</p>`;
        }
    }

    public dispose() {
        HtmlPreviewPanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
