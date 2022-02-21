import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as taxi from '../../extension';

suite('Taxi for Email Validation Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('displayDiagnostics - empty, with & without summary', async () => {

		let dcoll = vscode.languages.createDiagnosticCollection('taxi');
		const startTime = new Date();
		const result: taxi.Result = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_errors: 0,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_warnings: 0,
			errors: {}, // API returns empty object, rather than zero-length array
			warnings: {},
		};

		const doc = await vscode.workspace.openTextDocument({
			content: 'The quick brown fox'
		});
		const ed = await vscode.window.showTextDocument(doc);

		const diags = taxi.displayDiagnostics(result, doc, startTime, false);
		assert.strictEqual(diags.length, result.total_errors + result.total_warnings + 0);

		const diags2 = taxi.displayDiagnostics(result, doc, startTime, true);
		assert.strictEqual(diags2.length, result.total_errors + result.total_warnings + 1);

		// See https://stackoverflow.com/questions/44733028/how-to-close-textdocument-in-vs-code
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

	test('displayDiagnostics - errors & warnings, with & without summary', async () => {

		let dcoll = vscode.languages.createDiagnosticCollection('taxi');
		const startTime = new Date();
		const result: taxi.Result = {
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_errors: 1,
			// eslint-disable-next-line @typescript-eslint/naming-convention
			total_warnings: 2,
			errors: [
				{
					type: 'ERROR',
					message: 'Huge errors found',
					details: [
						'One problem',
						'split across multiple lines',
					]
				}
			],
			warnings: [
				{
					type: 'WARN',
					message: 'Some minor problem',
					details: 'A warning',
				},
				{
					type: 'WARN',
					message: 'Another minor problem',
					details: 'Another warning',
				}
			],
		};

		const doc = await vscode.workspace.openTextDocument({
			content: 'The quick brown fox'
		});
		const ed = await vscode.window.showTextDocument(doc);

		const diags = taxi.displayDiagnostics(result, doc, startTime, false);
		assert.strictEqual(diags.length, result.total_errors + result.total_warnings + 0);

		const diags2 = taxi.displayDiagnostics(result, doc, startTime, true);
		assert.strictEqual(diags2.length, result.total_errors + result.total_warnings + 1);

		// See https://stackoverflow.com/questions/44733028/how-to-close-textdocument-in-vs-code
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

});
