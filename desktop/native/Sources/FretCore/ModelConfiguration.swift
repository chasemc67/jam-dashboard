/// Explicit identity controls postprocessing; input dimensions alone never enable refitting.
public struct FretModelConfiguration {
    public let inputSize: Int
    public let usesRefit: Bool

    public init?(packageName: String) {
        switch packageName {
        case "FretTrackerV1", "FretTrackerV3":
            inputSize = 640; usesRefit = false
        case "FretTrackerV4Q832", "FretTrackerR832W8A8":
            inputSize = 832; usesRefit = true
        case "FretTrackerExtended512W8A8":
            inputSize = 512; usesRefit = true
        default: return nil
        }
    }
}
