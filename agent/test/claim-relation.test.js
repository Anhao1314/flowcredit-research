// RelationInput resolution and the Compatibility gate run under the Agent test entry
// (`npm test`, `verify-release`) while the suites stay with their runtime under
// research/claim-relation-test. Thin importers, same pattern as claim-relation-spike.
import '../../research/claim-relation-test/resolve.test.js';
import '../../research/claim-relation-test/compatibility.test.js';
import '../../research/claim-relation-test/gate.test.js';
import '../../research/claim-relation-test/benchmark-gate.test.js';
