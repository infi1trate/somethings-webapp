// THE PANE'S CONTENT VOCABULARY.
//
// One barrel so a pane body imports its primitives from one place, and so the
// set is legible as a set — the pane's problem was having ONE primitive and
// using it for everything, and a list of eight is the correction being visible.
//
// C2 built these and re-expressed the existing content through them where it
// maps 1:1. C3 rewires per-type content.
export { PaneShell, PaneSection, SECTION_GAP, PANE_PAD } from "./pane-shell";
export { PaneHeader, OutcomePill, OUTCOME_TONE } from "./pane-header";
export { MetadataList, type MetadataItem } from "./metadata-list";
export { DocumentPreview } from "./document-preview";
export { QuoteBlock } from "./quote-block";
export { RelatedRecord } from "./related-record";
export { TrendStrip } from "./trend-strip";
export { ChangeLog } from "./change-log";
export { PaneActions, type SecondaryAction } from "./pane-actions";
