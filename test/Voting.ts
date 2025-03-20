import { expect } from "chai";
import { ethers } from "hardhat";
import { Voting } from "../typechain-types";
import { Signer } from "ethers/lib/ethers";

describe("Voting", function () {
  let VotingFactory: any;
  let voting: Voting;
  let owner: Signer;
  let voter1: Signer;
  let voter2: Signer;
  let voter3: Signer;
  let voter4: Signer;
  let voter5: Signer;

  beforeEach(async function () {
    // Déploie un nouveau contrat Voting avant chaque test
    [owner, voter1, voter2, voter3, voter4, voter5] = await ethers.getSigners();
    VotingFactory = await ethers.getContractFactory("Voting");
    voting = (await VotingFactory.deploy()) as Voting;
    await voting.waitForDeployment();
  });

  it("Devrait enregistrer un électeur", async function () {
    // Teste l'enregistrement d'un électeur
    await voting.addVoter(await voter1.getAddress());
    const voter = await voting.voters(await voter1.getAddress());
    expect(voter.isRegistered).to.be.true; // Vérifie que l'électeur est bien enregistré
  });

  it("Ne doit pas permettre d'enregistrer deux fois le même électeur", async function () {
    // Teste que l'enregistrement d'un électeur déjà inscrit échoue
    await voting.addVoter(await voter1.getAddress());
    await expect(voting.addVoter(await voter1.getAddress())).to.be.revertedWith("Cet electeur est deja inscrit");
  });

  it("Doit permettre d'ajouter une proposition", async function () {
    // Teste l'ajout d'une proposition par un électeur inscrit
    await voting.addVoter(await voter1.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    const proposal = await voting.proposals(0);
    expect(proposal.description).to.equal("Proposition 1"); // Vérifie que la proposition est bien enregistrée
  });

  it("Ne doit pas permettre d'ajouter une proposition si l'enregistrement est fermé", async function () {
    // Teste que l'ajout d'une proposition échoue si l'enregistrement est fermé
    await voting.addVoter(await voter1.getAddress());
    await expect(voting.connect(voter1).submitProposal("Proposition 1")).to.be.revertedWith("L enregistrement des propositions est ferme");
  });

  it("Doit permettre de voter", async function () {
    // Teste qu'un électeur peut voter pour une proposition
    await voting.addVoter(await voter1.getAddress());
    await voting.addVoter(await voter2.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();
    await voting.connect(voter1).vote(0);
    const voter = await voting.voters(await voter1.getAddress());
    expect(voter.hasVoted).to.be.true; // Vérifie que l'électeur a voté
  });

  it("Doit permettre de modifier un vote", async function () {
    // Teste qu'un électeur peut modifier son vote
    await voting.addVoter(await voter1.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.connect(voter1).submitProposal("Proposition 2");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();

    // Premier vote
    await voting.connect(voter1).vote(0);
    let proposal1 = await voting.proposals(0);
    let proposal2 = await voting.proposals(1);
    expect(proposal1.voteCount).to.equal(1); // Vérifie que le vote est comptabilisé
    expect(proposal2.voteCount).to.equal(0);

    // Modification du vote
    await voting.connect(voter1).vote(1);
    proposal1 = await voting.proposals(0);
    proposal2 = await voting.proposals(1);
    expect(proposal1.voteCount).to.equal(0); // Vérifie que l'ancien vote est retiré
    expect(proposal2.voteCount).to.equal(1); // Vérifie que le nouveau vote est comptabilisé
  });

  it("Ne doit pas permettre de voter pour une proposition invalide", async function () {
    // Teste que voter pour une proposition invalide échoue
    await voting.addVoter(await voter1.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();
    await expect(voting.connect(voter1).vote(99)).to.be.revertedWith("ID de proposition invalide");
  });

  it("Ne doit pas permettre de voter après la fin de la session", async function () {
    // Teste que voter après la fin de la session échoue
    await voting.addVoter(await voter1.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();
    await voting.connect(voter1).vote(0);
    await voting.endVotingSession();
    await expect(voting.connect(voter1).vote(0)).to.be.revertedWith("Le vote est ferme");
  });

  it("Doit compter les votes correctement et désigner un gagnant", async function () {
    // Teste que les votes sont comptés correctement et qu'un gagnant est désigné
    await voting.addVoter(await voter1.getAddress());
    await voting.addVoter(await voter2.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.connect(voter1).submitProposal("Proposition 2");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();
    await voting.connect(voter1).vote(0);
    await voting.connect(voter2).vote(0);
    await voting.endVotingSession();
    await voting.tallyVotes();
    const winningProposal = await voting.getWinningProposal();
    expect(winningProposal).to.equal("Proposition 1"); // Vérifie que la proposition gagnante est correcte
  });

  it("Doit récupérer les informations d'un électeur", async function () {
    // Teste la récupération des informations d'un électeur
    await voting.addVoter(await voter1.getAddress());
    await voting.addVoter(await owner.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();
    await voting.connect(voter1).vote(0);

    const voterInfo = await voting.getVoterInfo(await voter1.getAddress());
    expect(voterInfo.hasVoted).to.be.true; // Vérifie que l'électeur a voté
    expect(voterInfo.votedProposalId).to.equal(0); // Vérifie l'ID de la proposition votée
  });

  it("Doit retourner le nombre total de propositions", async function () {
    // Teste la récupération du nombre total de propositions
    await voting.addVoter(await voter1.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.connect(voter1).submitProposal("Proposition 2");
    await voting.endProposalsRegistration();

    const proposalsCount = await voting.getProposalsCount();
    expect(proposalsCount).to.equal(2); // Vérifie que le nombre de propositions est correct
  });

  it("Doit permettre à l'administrateur de modifier le quorum", async function () {
    // Teste que l'administrateur peut modifier le quorum
    await voting.setQuorum(60);
    const newQuorum = await voting.quorumPercentage();
    expect(newQuorum).to.equal(60); // Vérifie que le quorum est mis à jour
  });

  it("Ne doit pas permettre à un non-administrateur de modifier le quorum", async function () {
    // Teste que seul l'administrateur peut modifier le quorum
    await expect(voting.connect(voter1).setQuorum(60)).to.be.revertedWith("Seul l administrateur peut effectuer cette action");
  });

  it("Doit retourner le pourcentage de participation actuel", async function () {
    // Teste la récupération du pourcentage de participation
    await voting.addVoter(await voter1.getAddress());
    await voting.addVoter(await voter2.getAddress());
    await voting.startProposalsRegistration();
    await voting.connect(voter1).submitProposal("Proposition 1");
    await voting.endProposalsRegistration();
    await voting.startVotingSession();
    await voting.connect(voter1).vote(0);

    const participation = await voting.getCurrentParticipation();
    expect(participation).to.equal(50); // Vérifie que le pourcentage de participation est correct
  });

  describe("Tests de quorum", function () {
    beforeEach(async function () {
      // Ajoute 5 électeurs à la liste blanche
      await voting.addVoter(await voter1.getAddress());
      await voting.addVoter(await voter2.getAddress());
      await voting.addVoter(await voter3.getAddress());
      await voting.addVoter(await voter4.getAddress());
      await voting.addVoter(await voter5.getAddress());
      
      // Démarrer l'enregistrement des propositions
      await voting.startProposalsRegistration();
      
      // Soumettre des propositions
      await voting.connect(voter1).submitProposal("Proposition 1");
      await voting.connect(voter2).submitProposal("Proposition 2");
      
      // Terminer l'enregistrement des propositions
      await voting.endProposalsRegistration();
      
      // Démarrer la session de vote
      await voting.startVotingSession();
    });
    
    it("Devrait définir le quorum par défaut à 50%", async function () {
      // Vérifie que le quorum est bien initialisé à 50% par défaut
      expect(await voting.quorumPercentage()).to.equal(50);
    });
    
    it("Devrait permettre à l'administrateur de modifier le quorum", async function () {
      // Teste que l'administrateur peut modifier le quorum et que l'événement est émis
      await expect(voting.setQuorum(75))
        .to.emit(voting, "QuorumUpdated")
        .withArgs(50, 75);
        
      expect(await voting.quorumPercentage()).to.equal(75);
    });
    
    it("Ne devrait pas permettre à un non-administrateur de modifier le quorum", async function () {
      // Vérifie qu'un non-administrateur ne peut pas modifier le quorum
      await expect(voting.connect(voter1).setQuorum(30))
        .to.be.revertedWith("Seul l administrateur peut effectuer cette action");
    });
    
    it("Ne devrait pas permettre un pourcentage de quorum supérieur à 100", async function () {
      // Vérifie que le quorum ne peut pas dépasser 100%
      await expect(voting.setQuorum(101))
        .to.be.revertedWith("Le pourcentage doit etre entre 0 et 100");
    });
    
    it("Devrait retourner le pourcentage correct de participation", async function () {
      // Vérifie que le calcul de la participation est correct
      
      // Participation initiale à 0%
      expect(await voting.getCurrentParticipation()).to.equal(0);
      
      // Deux électeurs votent (2/5 = 40%)
      await voting.connect(voter1).vote(0);
      await voting.connect(voter2).vote(1);
      
      expect(await voting.getCurrentParticipation()).to.equal(40);
      
      // Un troisième électeur vote (3/5 = 60%)
      await voting.connect(voter3).vote(0);
      
      expect(await voting.getCurrentParticipation()).to.equal(60);
    });
    
    it("Devrait échouer au décompte des votes si le quorum n'est pas atteint", async function () {
      // Vérifie que le décompte des votes échoue si le quorum n'est pas atteint
      
      // Seulement 2 électeurs votent (40% de participation)
      await voting.connect(voter1).vote(0);
      await voting.connect(voter2).vote(1);
      
      // Terminer la session de vote
      await voting.endVotingSession();
      
      // Devrait échouer car le quorum par défaut est de 50%
      await expect(voting.tallyVotes())
        .to.be.revertedWith("Le quorum de participation minimum n'a pas ete atteint");
    });
    
    it("Devrait réussir le décompte des votes quand le quorum est atteint", async function () {
      // Vérifie que le décompte des votes fonctionne quand le quorum est atteint
      
      // 3 électeurs votent (60% de participation)
      await voting.connect(voter1).vote(0);
      await voting.connect(voter2).vote(0);
      await voting.connect(voter3).vote(1);
      
      // Terminer la session de vote
      await voting.endVotingSession();
      
      // Devrait réussir car la participation (60%) > quorum (50%)
      await expect(voting.tallyVotes())
        .to.emit(voting, "WorkflowStatusChange");
        
      // Vérifier la proposition gagnante
      expect(await voting.winningProposalId()).to.equal(0);
    });
    
    it("Devrait réussir le décompte des votes quand le quorum est abaissé", async function () {
      // Vérifie que l'abaissement du quorum permet de valider une élection
      
      // Seulement 2 électeurs votent (40% de participation)
      await voting.connect(voter1).vote(0);
      await voting.connect(voter2).vote(1);
      
      // Terminer la session de vote
      await voting.endVotingSession();
      
      // Abaisser le quorum à 40%
      await voting.setQuorum(40);
      
      // Devrait maintenant réussir car la participation (40%) >= quorum (40%)
      await expect(voting.tallyVotes())
        .to.emit(voting, "WorkflowStatusChange");
    });
  });
});