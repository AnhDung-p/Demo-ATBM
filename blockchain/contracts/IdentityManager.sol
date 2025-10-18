// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract IdentityManager {
    struct User { bytes32 emailHash; bool registered; }
    mapping(address => User) public users;
    event Registered(address indexed user, bytes32 emailHash);

    function register(bytes32 _emailHash) external {
        require(!users[msg.sender].registered, "Already registered");
        users[msg.sender] = User({emailHash: _emailHash, registered: true});
        emit Registered(msg.sender, _emailHash);
    }
    function isRegistered(address _user) external view returns (bool) {
        return users[_user].registered;
    }
    function getEmailHash(address _user) external view returns (bytes32) {
        return users[_user].emailHash;
    }
}
