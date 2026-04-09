import * as vscode from 'vscode';

export class UImakerTreeViewProvider implements vscode.TreeDataProvider<TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<TreeItem | undefined | null | void> = new vscode.EventEmitter<TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: TreeItem): Thenable<TreeItem[]> {
        if (!element) {
            return Promise.resolve([
                new TreeItem('Initialize HTML UI', '初期化', vscode.TreeItemCollapsibleState.None, {
                    command: 'uimaker-ext.init',
                    title: 'Initialize HTML UI'
                }),
                new TreeItem('Generate C/Code', '生成', vscode.TreeItemCollapsibleState.None, {
                    command: 'uimaker-ext.generate',
                    title: 'Generate C/Code & Start Server'
                }),
                new TreeItem('Open HTML View', 'プレビュー', vscode.TreeItemCollapsibleState.None, {
                    command: 'uimaker-ext.openHtmlView',
                    title: 'Open HTML View'
                })
            ]);
        }
        return Promise.resolve([]);
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly description: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly command?: vscode.Command
    ) {
        super(label, collapsibleState);
        this.description = description;
        this.command = command;
    }
}
