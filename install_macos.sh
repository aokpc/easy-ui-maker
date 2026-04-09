echo "installing..."

echo "installing arduino extension"
cp ./extension/uimaker-ext-0.0.1.vsix ~/.arduinoIDE/plugins/

echo "installing arduino extension (recommended-extensions)"
cp -r ./recommended-extensions/* ~/.arduinoIDE/deployedPlugins/

echo "done."