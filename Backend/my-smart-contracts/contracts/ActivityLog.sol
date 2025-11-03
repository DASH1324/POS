// contracts/ActivityLog.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract ActivityLog {
    struct LogEntry {
        uint256 timestamp;
        string serviceIdentifier;
        string action; // "POST", "PATCH", "DELETE"
        string entityType; // "discount", "promotion", "sale"
        uint256 entityId;
        address actor; // wallet address of the user
        string actorUsername;
        string changeDescription;
        bytes32 dataHash; // Hash of the changed data
    }
    
    LogEntry[] private logs;
    
    // Mapping for quick lookup
    mapping(string => uint256[]) private logsByService;
    mapping(string => uint256[]) private logsByEntity;
    mapping(address => uint256[]) private logsByActor;
    
    event ActivityLogged(
        uint256 indexed logId,
        uint256 timestamp,
        string serviceIdentifier,
        string action,
        string entityType,
        uint256 entityId,
        address indexed actor,
        string actorUsername
    );
    
    function logActivity(
        string memory _serviceIdentifier,
        string memory _action,
        string memory _entityType,
        uint256 _entityId,
        address _actor,
        string memory _actorUsername,
        string memory _changeDescription,
        bytes32 _dataHash
    ) public returns (uint256) {
        uint256 logId = logs.length;
        
        LogEntry memory newLog = LogEntry({
            timestamp: block.timestamp,
            serviceIdentifier: _serviceIdentifier,
            action: _action,
            entityType: _entityType,
            entityId: _entityId,
            actor: _actor,
            actorUsername: _actorUsername,
            changeDescription: _changeDescription,
            dataHash: _dataHash
        });
        
        logs.push(newLog);
        
        logsByService[_serviceIdentifier].push(logId);
        logsByEntity[_entityType].push(logId);
        logsByActor[_actor].push(logId);
        
        emit ActivityLogged(
            logId,
            block.timestamp,
            _serviceIdentifier,
            _action,
            _entityType,
            _entityId,
            _actor,
            _actorUsername
        );
        
        return logId;
    }
    
    function getLog(uint256 _logId) public view returns (LogEntry memory) {
        require(_logId < logs.length, "Log does not exist");
        return logs[_logId];
    }
    
    function getLogsByService(string memory _serviceIdentifier) 
        public view returns (uint256[] memory) {
        return logsByService[_serviceIdentifier];
    }
    
    function getLogsByEntity(string memory _entityType) 
        public view returns (uint256[] memory) {
        return logsByEntity[_entityType];
    }
    
    function getLogsByActor(address _actor) 
        public view returns (uint256[] memory) {
        return logsByActor[_actor];
    }
    
    function getTotalLogs() public view returns (uint256) {
        return logs.length;
    }
}