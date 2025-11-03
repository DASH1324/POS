// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title ActivityLogger
 * @dev Smart contract for logging all POST and PATCH operations from microservices
 */
contract ActivityLogger {
    
    struct ActivityLog {
        uint256 logId;
        string serviceIdentifier;  // e.g., "POS_SALES", "DISCOUNTS", "PROMOTIONS"
        string action;             // e.g., "CREATE", "UPDATE", "DELETE"
        string entityType;         // e.g., "Sale", "Discount", "Promotion"
        uint256 entityId;          // ID of the entity in the database
        string actorUsername;      // Username of the person performing the action
        address actorAddress;      // Ethereum address that logged this action
        string changeDescription;  // Description of what changed
        string dataHash;           // SHA-256 hash of the data
        uint256 timestamp;         // Block timestamp
    }
    
    // Storage
    mapping(uint256 => ActivityLog) public activityLogs;
    uint256 public logCount;
    
    // Events
    event ActivityLogged(
        uint256 indexed logId,
        string serviceIdentifier,
        string action,
        address indexed actorAddress,
        uint256 timestamp
    );
    
    /**
     * @dev Log a new activity
     * @param _serviceIdentifier The service that performed the action
     * @param _action The type of action (CREATE, UPDATE, DELETE)
     * @param _entityType The type of entity affected
     * @param _entityId The ID of the entity
     * @param _actorUsername The username of the actor
     * @param _changeDescription Description of the changes
     * @param _dataHash Hash of the data for integrity verification
     * @return The ID of the newly created log
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
        
        emit ActivityLogged(
            newLogId,
            _serviceIdentifier,
            _action,
            msg.sender,
            block.timestamp
        );
        
        return newLogId;
    }
    
    /**
     * @dev Get the total number of logs
     * @return The total count of activity logs
     */
    function getLogCount() public view returns (uint256) {
        return logCount;
    }
    
    /**
     * @dev Get a specific activity log by ID
     * @param _logId The ID of the log to retrieve
     * @return The ActivityLog struct
     */
    function getLog(uint256 _logId) public view returns (ActivityLog memory) {
        require(_logId < logCount, "Log does not exist");
        return activityLogs[_logId];
    }
    
    /**
     * @dev Get logs by service identifier (view function for frontend)
     * @param _serviceIdentifier The service to filter by
     * @param _limit Maximum number of logs to return
     * @return Array of matching ActivityLog structs
     */
    function getLogsByService(string memory _serviceIdentifier, uint256 _limit) 
        public 
        view 
        returns (ActivityLog[] memory) 
    {
        // First pass: count matching logs
        uint256 matchCount = 0;
        for (uint256 i = 0; i < logCount && matchCount < _limit; i++) {
            if (keccak256(bytes(activityLogs[i].serviceIdentifier)) == keccak256(bytes(_serviceIdentifier))) {
                matchCount++;
            }
        }
        
        // Second pass: populate array
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
    
    /**
     * @dev Get logs by actor username
     * @param _actorUsername The username to filter by
     * @param _limit Maximum number of logs to return
     * @return Array of matching ActivityLog structs
     */
    function getLogsByActor(string memory _actorUsername, uint256 _limit) 
        public 
        view 
        returns (ActivityLog[] memory) 
    {
        // First pass: count matching logs
        uint256 matchCount = 0;
        for (uint256 i = 0; i < logCount && matchCount < _limit; i++) {
            if (keccak256(bytes(activityLogs[i].actorUsername)) == keccak256(bytes(_actorUsername))) {
                matchCount++;
            }
        }
        
        // Second pass: populate array
        ActivityLog[] memory result = new ActivityLog[](matchCount);
        uint256 resultIndex = 0;
        for (uint256 i = 0; i < logCount && resultIndex < matchCount; i++) {
            if (keccak256(bytes(activityLogs[i].actorUsername)) == keccak256(bytes(_actorUsername))) {
                result[resultIndex] = activityLogs[i];
                resultIndex++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev Verify data integrity by comparing hashes
     * @param _logId The ID of the log to verify
     * @param _dataHash The hash to compare against
     * @return bool indicating if the hashes match
     */
    function verifyLogIntegrity(uint256 _logId, string memory _dataHash) 
        public 
        view 
        returns (bool) 
    {
        require(_logId < logCount, "Log does not exist");
        return keccak256(bytes(activityLogs[_logId].dataHash)) == keccak256(bytes(_dataHash));
    }
}