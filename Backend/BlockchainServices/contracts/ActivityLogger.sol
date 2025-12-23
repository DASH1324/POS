// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ActivityLogger
 * @dev Smart contract for logging all POST and PATCH operations with full explorer visibility
 */
contract ActivityLogger {
    
    struct ActivityLog {
        uint256 logId;
        string serviceIdentifier;  // e.g., "POS_SALES"
        string action;              // e.g., "CREATE"
        string entityType;          // e.g., "Sale"
        uint256 entityId;           // ID of the entity in the database
        string actorUsername;       // Username of the person
        address actorAddress;       // Ethereum address
        string changeDescription;   // Details: "Purchased 2x Coffee, 1x Cake"
        string dataHash;            // SHA-256 hash
        uint256 timestamp;          // Block timestamp
    }
    
    // Storage
    mapping(uint256 => ActivityLog) public activityLogs;
    uint256 public logCount;
    
    // UPDATED EVENT: Added all detail fields so they show up in the "Logs" or "Events" tab
    event ActivityLogged(
        uint256 indexed logId,
        string serviceIdentifier,
        string action,
        string entityType,        // Now visible in explorer
        uint256 entityId,         // Now visible in explorer
        string actorUsername,     // Now visible in explorer
        address indexed actorAddress,
        string changeDescription, // This holds your "What and How Much"
        uint256 timestamp
    );
    
    /**
     * @dev Log a new activity with full event emission
     */
    function logActivity(
        string memory _serviceIdentifier,
        string memory _action,
        string memory _entityType,
        uint256 _entityId,
        string memory _actorUsername,
        string memory _changeDescription,
        string memory _dataHash
    ) public returns (uint256) {
        
        uint256 newLogId = logCount;
        
        activityLogs[newLogId] = ActivityLog({
            logId: newLogId,
            serviceIdentifier: _serviceIdentifier,
            action: _action,
            entityType: _entityType,
            entityId: _entityId,
            actorUsername: _actorUsername,
            actorAddress: msg.sender,
            changeDescription: _changeDescription,
            dataHash: _dataHash,
            timestamp: block.timestamp
        });
        
        logCount++;
        
        // UPDATED EMIT: Sending all details to the Event Logs
        emit ActivityLogged(
            newLogId,
            _serviceIdentifier,
            _action,
            _entityType,
            _entityId,
            _actorUsername,
            msg.sender,
            _changeDescription,
            block.timestamp
        );
        
        return newLogId;
    }
    
    // --- View Functions ---

    function getLogCount() public view returns (uint256) {
        return logCount;
    }
    
    function getLog(uint256 _logId) public view returns (ActivityLog memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId];
    }
    
    function getLogsByService(string memory _serviceIdentifier, uint256 _limit) 
        public 
        view 
        returns (ActivityLog[] memory) 
    {
        uint256 matchCount = 0;
        for (uint256 i = 0; i < logCount && matchCount < _limit; i++) {
            if (keccak256(bytes(activityLogs[i].serviceIdentifier)) == keccak256(bytes(_serviceIdentifier))) {
                matchCount++;
            }
        }
        
        ActivityLog[] memory result = new ActivityLog[](matchCount);
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < logCount && resultIndex < matchCount; i++) {
            if (keccak256(bytes(activityLogs[i].serviceIdentifier)) == keccak256(bytes(_serviceIdentifier))) {
                result[resultIndex] = activityLogs[i];
                resultIndex++;
            }
        }
        return result;
    }

    function verifyLogIntegrity(uint256 _logId, string memory _dataHash)
        public
        view
        returns (bool)
    {
        require(_logId < logCount, "Log does not exist");
        return keccak256(bytes(activityLogs[_logId].dataHash)) == keccak256(bytes(_dataHash));
    }

    // Individual getter functions for better explorer visibility
    function getLogServiceIdentifier(uint256 _logId) public view returns (string memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].serviceIdentifier;
    }

    function getLogAction(uint256 _logId) public view returns (string memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].action;
    }

    function getLogEntityType(uint256 _logId) public view returns (string memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].entityType;
    }

    function getLogEntityId(uint256 _logId) public view returns (uint256) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].entityId;
    }

    function getLogActorUsername(uint256 _logId) public view returns (string memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].actorUsername;
    }

    function getLogActorAddress(uint256 _logId) public view returns (address) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].actorAddress;
    }

    function getLogChangeDescription(uint256 _logId) public view returns (string memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].changeDescription;
    }

    function getLogDataHash(uint256 _logId) public view returns (string memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].dataHash;
    }

    function getLogTimestamp(uint256 _logId) public view returns (uint256) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId].timestamp;
    }
}
