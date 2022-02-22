import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import * as taxi from '../../extension';


// Calculated expected length of an API result, with/without summary
function expectedLength(result: taxi.Result, summary: boolean): number {
	let combined: taxi.ResultDetails[] = Object.values(result.errors).concat(Object.values(result.warnings));
	var l = 0;
	for (const e of combined) {
		if (typeof e.details === 'string') {
			l += 1;
		} else if (typeof e.details === 'object') {
			l += e.details.length;
		}
		else {
			assert.fail(`Unexpected type ${typeof e.details} found in ${e}`);
		}
	}
	return l + (summary ? 1 : 0); // allow for 1 extra if there's a summary
}


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

		var summary = false;
		const diags = taxi.displayDiagnostics(result, doc, startTime, summary);
		assert.strictEqual(diags.length, expectedLength(result, summary));

		summary = true;
		const diags2 = taxi.displayDiagnostics(result, doc, startTime, summary);
		assert.strictEqual(diags2.length, expectedLength(result, summary));

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

		var summary = false;
		const diags = taxi.displayDiagnostics(result, doc, startTime, summary);
		assert.strictEqual(diags.length, expectedLength(result, summary));

		summary = true;
		const diags2 = taxi.displayDiagnostics(result, doc, startTime, summary);
		assert.strictEqual(diags2.length, expectedLength(result, summary));

		// See https://stackoverflow.com/questions/44733028/how-to-close-textdocument-in-vs-code
		await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
	});

});
