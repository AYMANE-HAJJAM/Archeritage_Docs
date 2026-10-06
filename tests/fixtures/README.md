# Test fixtures

Checked-in samples used by automated tests. Do not put the full Safi import corpus here.

| Path | Used by |
|------|---------|
| `office/sample.docx` | `tests/storage/document-converter.test.ts` (LibreOffice → PDF) |
| `office/sample.pptx` | PowerPoint → PDF and temporary-directory cleanup |
| `office/sample.xlsx` | Excel → PDF and temporary-directory cleanup |

The PPTX/XLSX samples contain synthetic preview-test content generated with
LibreOffice, with no uploaded or production files. Integration conversion tests
skip when LibreOffice is absent; missing checked-in fixtures fail the test.

Optional local corpus for ops / hash verification: project-root `source_import/` (gitignored).
