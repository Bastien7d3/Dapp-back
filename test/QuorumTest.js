const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Voting Contract - Quorum Tests", function() {
  let VotingContract;
  let votingInstance;
  let owner;
  let voter1, voter2, voter3, voter4, voter5;
  
  beforeEach(async function() {
    [owner, voter1, voter2, voter3, voter4, voter5] = await ethers.getSigners();
    
    VotingContract = await ethers.getContractFactory("Voting");
    votingInstance = await VotingContract.deploy();
    await votingInstance.deployed();
    
    // Add voters to whitelist
    await votingInstance.addVoter(voter1.address);
    await votingInstance.addVoter(voter2.address);
    await votingInstance.addVoter(voter3.address);
    await votingInstance.addVoter(voter4.address);
    await votingInstance.addVoter(voter5.address);
    
    // Start proposal registration
    await votingInstance.startProposalsRegistration();
    
    // Submit proposals
    await votingInstance.connect(voter1).submitProposal("Proposal 1");
    await votingInstance.connect(voter2).submitProposal("Proposal 2");
    
    // End proposal registration
    await votingInstance.endProposalsRegistration();
    
    // Start voting session
    await votingInstance.startVotingSession();
  });
  
  it("should set the default quorum to 50%", async function() {
    expect(await votingInstance.quorumPercentage()).to.equal(50);
  });
  
  it("should allow admin to change quorum", async function() {
    await expect(votingInstance.setQuorum(75))
      .to.emit(votingInstance, "QuorumUpdated")
      .withArgs(50, 75);
      
    expect(await votingInstance.quorumPercentage()).to.equal(75);
  });
  
  it("should not allow non-admin to change quorum", async function() {
    await expect(votingInstance.connect(voter1).setQuorum(30))
      .to.be.revertedWith("Seul l administrateur peut effectuer cette action");
  });
  
  it("should not allow quorum percentage greater than 100", async function() {
    await expect(votingInstance.setQuorum(101))
      .to.be.revertedWith("Le pourcentage doit etre entre 0 et 100");
  });
  
  it("should return correct participation percentage", async function() {
    // Initial participation is 0%
    expect(await votingInstance.getCurrentParticipation()).to.equal(0);
    
    // Two voters vote (2/5 = 40%)
    await votingInstance.connect(voter1).vote(0);
    await votingInstance.connect(voter2).vote(1);
    
    expect(await votingInstance.getCurrentParticipation()).to.equal(40);
    
    // Third voter votes (3/5 = 60%)
    await votingInstance.connect(voter3).vote(0);
    
    expect(await votingInstance.getCurrentParticipation()).to.equal(60);
  });
  
  it("should fail to tally votes if quorum not met", async function() {
    // Only 2 voters vote (40% participation)
    await votingInstance.connect(voter1).vote(0);
    await votingInstance.connect(voter2).vote(1);
    
    // End voting session
    await votingInstance.endVotingSession();
    
    // Should fail because default quorum is 50%
    await expect(votingInstance.tallyVotes())
      .to.be.revertedWith("Le quorum de participation minimum n'a pas ete atteint");
  });
  
  it("should succeed to tally votes when quorum is met", async function() {
    // 3 voters vote (60% participation)
    await votingInstance.connect(voter1).vote(0);
    await votingInstance.connect(voter2).vote(0);
    await votingInstance.connect(voter3).vote(1);
    
    // End voting session
    await votingInstance.endVotingSession();
    
    // Should succeed because participation (60%) > quorum (50%)
    await expect(votingInstance.tallyVotes())
      .to.emit(votingInstance, "WorkflowStatusChange");
      
    // Verify winning proposal
    expect(await votingInstance.winningProposalId()).to.equal(0);
  });
  
  it("should succeed to tally votes when quorum is lowered", async function() {
    // Only 2 voters vote (40% participation)
    await votingInstance.connect(voter1).vote(0);
    await votingInstance.connect(voter2).vote(1);
    
    // End voting session
    await votingInstance.endVotingSession();
    
    // Lower the quorum to 40%
    await votingInstance.setQuorum(40);
    
    // Should now succeed because participation (40%) >= quorum (40%)
    await expect(votingInstance.tallyVotes())
      .to.emit(votingInstance, "WorkflowStatusChange");
  });
});
