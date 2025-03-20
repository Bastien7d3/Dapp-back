// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Voting
 * @dev Un contrat de vote permettant à une organisation de gérer des élections 
 *      avec une liste blanche d'électeurs, l'ajout de propositions et le vote.
 */
contract Voting is Ownable {
    /// @dev Structure représentant une proposition.
    struct Proposal {
        string description; // Description de la proposition
        uint voteCount; // Nombre de votes reçus
    }

    /// @dev Structure représentant un électeur.
    struct Voter {
        bool isRegistered; // Indique si l'électeur est inscrit sur la liste blanche
        bool hasVoted; // Indique si l'électeur a déjà voté
        uint votedProposalId; // ID de la proposition votée
    }

    /// @dev Enumération des différents états du processus de vote.
    enum WorkflowStatus {
        RegisteringVoters,           // Enregistrement des électeurs
        ProposalsRegistrationStarted,// Début de l'enregistrement des propositions
        ProposalsRegistrationEnded,  // Fin de l'enregistrement des propositions
        VotingSessionStarted,        // Début de la session de vote
        VotingSessionEnded,          // Fin de la session de vote
        VotesTallied                 // Comptabilisation des votes terminée
    }

    WorkflowStatus public workflowStatus; // État actuel du processus de vote (renommé de "state" à "workflowStatus")
    mapping(address => Voter) public voters; // Mapping des électeurs
    Proposal[] public proposals; // Liste des propositions
    address[] private whitelist;
    uint public winningProposalId; // ID de la proposition gagnante
    uint public quorumPercentage; // Pourcentage minimum de participation requis
    uint public votersCount; // Nombre total d'électeurs inscrits

    /// @dev Événements pour suivre les actions importantes du contrat.
    event VoterRegistered(address voterAddress);
    event WorkflowStatusChange(WorkflowStatus previousStatus, WorkflowStatus newStatus);
    event ProposalRegistered(uint proposalId);
    event Voted(address voter, uint proposalId);
    event VoteModified(address voter, uint oldProposalId, uint newProposalId);
    event QuorumUpdated(uint oldQuorum, uint newQuorum);

    /// @dev Vérifie que seul l'administrateur peut exécuter l'action.
    modifier onlyAdmin() {
        require(owner() == msg.sender, "Seul l administrateur peut effectuer cette action");
        _;
    }

    /// @dev Vérifie que l'utilisateur est sur la liste blanche des électeurs.
    modifier onlyWhitelisted() {
        require(voters[msg.sender].isRegistered, "Vous n etes pas sur la liste blanche");
        _;
    }

    /**
     * @dev Constructeur du contrat.
     * L'administrateur (owner) est celui qui déploie le contrat.
     */
    constructor() Ownable(msg.sender) {
        workflowStatus = WorkflowStatus.RegisteringVoters; // Initialise l'état à l'enregistrement des électeurs
        quorumPercentage = 50; // Par défaut, 50% de participation est requise
    }


    /**
     * @dev Ajoute un électeur à la liste blanche.
     * @notice Cette fonction ne peut être appelée que par l'administrateur pendant la phase d'enregistrement des électeurs.
     * @param _voter Adresse Ethereum de l'électeur à inscrire.
     * @custom:emits VoterRegistered Événement émis lorsqu'un électeur est enregistré.
     */
    function addVoter(address _voter) external onlyOwner {
        require(workflowStatus == WorkflowStatus.RegisteringVoters, "Enregistrement des electeurs ferme");
        require(!voters[_voter].isRegistered, "Cet electeur est deja inscrit");

        voters[_voter] = Voter(true, false, 0);
        votersCount++;
        whitelist.push(_voter);
        emit VoterRegistered(_voter);
    }
    function getWhitelist() external view returns (address[] memory) {
        return whitelist;
    }
    /**
     * @dev Démarre la session d'enregistrement des propositions.
     */
    function startProposalsRegistration() external onlyAdmin {
        require(workflowStatus == WorkflowStatus.RegisteringVoters, "L etat actuel ne permet pas cette action");

        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationStarted;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    /**
     * @dev Soumet une nouvelle proposition.
     * @notice Cette fonction ne peut être appelée que par un électeur inscrit pendant la phase d'enregistrement des propositions.
     * @param _description Description de la proposition.
     * @custom:emits ProposalRegistered Événement émis lorsqu'une proposition est enregistrée.
     */
    function submitProposal(string memory _description) external onlyWhitelisted {
        require(workflowStatus == WorkflowStatus.ProposalsRegistrationStarted, "L enregistrement des propositions est ferme"); // Vérifie que l'état permet l'enregistrement des propositions

        proposals.push(Proposal(_description, 0)); // Ajoute une nouvelle proposition avec un compteur de votes initialisé à 0
        emit ProposalRegistered(proposals.length - 1); // Émet un événement avec l'ID de la proposition
    }

    /**
     * @dev Termine la session d'enregistrement des propositions.
     */
    function endProposalsRegistration() external onlyAdmin {
        require(workflowStatus == WorkflowStatus.ProposalsRegistrationStarted, "L etat actuel ne permet pas cette action");

        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.ProposalsRegistrationEnded;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    /**
     * @dev Démarre la session de vote.
     */
    function startVotingSession() external onlyAdmin {
        require(workflowStatus == WorkflowStatus.ProposalsRegistrationEnded, "L etat actuel ne permet pas cette action");

        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionStarted;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    /**
     * @dev Permet à un électeur inscrit de voter pour une proposition.
     * @notice Cette fonction permet également de modifier un vote existant.
     * @param _proposalId ID de la proposition pour laquelle voter.
     * @custom:emits Voted Événement émis lorsqu'un électeur vote pour la première fois.
     * @custom:emits VoteModified Événement émis lorsqu'un électeur modifie son vote.
     */
    function vote(uint _proposalId) external onlyWhitelisted {
        require(workflowStatus == WorkflowStatus.VotingSessionStarted, "Le vote est ferme"); // Vérifie que la session de vote est ouverte
        require(_proposalId < proposals.length, "ID de proposition invalide"); // Vérifie que l'ID de la proposition est valide

        if (voters[msg.sender].hasVoted) {
            uint oldProposalId = voters[msg.sender].votedProposalId; // Récupère l'ID de la proposition précédemment votée
            proposals[oldProposalId].voteCount--; // Décrémente le compteur de votes de l'ancienne proposition
            voters[msg.sender].votedProposalId = _proposalId; // Met à jour l'ID de la proposition votée
            proposals[_proposalId].voteCount++; // Incrémente le compteur de votes de la nouvelle proposition
            emit VoteModified(msg.sender, oldProposalId, _proposalId); // Émet un événement pour signaler la modification du vote
        } else {
            voters[msg.sender].hasVoted = true; // Marque l'électeur comme ayant voté
            voters[msg.sender].votedProposalId = _proposalId; // Enregistre l'ID de la proposition votée
            proposals[_proposalId].voteCount++; // Incrémente le compteur de votes de la proposition
            emit Voted(msg.sender, _proposalId); // Émet un événement pour signaler le vote
        }
    }

    /**
     * @dev Termine la session de vote.
     */
    function endVotingSession() external onlyAdmin {
        require(workflowStatus == WorkflowStatus.VotingSessionStarted, "L etat actuel ne permet pas cette action");

        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.VotingSessionEnded;
        emit WorkflowStatusChange(previousStatus, workflowStatus);
    }

    /**
     * @dev Comptabilise les votes et détermine la proposition gagnante.
     * @notice Cette fonction vérifie également si le quorum de participation est atteint.
     * @custom:throws Si le quorum de participation n'est pas atteint.
     * @custom:emits WorkflowStatusChange Événement émis lorsque l'état du workflow change.
     */
    function tallyVotes() external onlyAdmin {
        require(workflowStatus == WorkflowStatus.VotingSessionEnded, "L etat actuel ne permet pas cette action"); // Vérifie que la session de vote est terminée

        uint votesCount = 0; // Initialise le compteur de votes
        for (uint i = 0; i < proposals.length; i++) {
            votesCount += proposals[i].voteCount; // Compte le nombre total de votes
        }

        uint participationPercentage = (votesCount * 100) / votersCount; // Calcule le pourcentage de participation
        require(participationPercentage >= quorumPercentage, "Le quorum de participation minimum n'a pas ete atteint"); // Vérifie que le quorum est atteint

        uint winningVoteCount = 0; // Initialise le compteur de votes gagnants
        for (uint i = 0; i < proposals.length; i++) {
            if (proposals[i].voteCount > winningVoteCount) {
                winningVoteCount = proposals[i].voteCount; // Met à jour le nombre de votes gagnants
                winningProposalId = i; // Met à jour l'ID de la proposition gagnante
            }
        }

        WorkflowStatus previousStatus = workflowStatus;
        workflowStatus = WorkflowStatus.VotesTallied; // Change l'état à "VotesTallied"
        emit WorkflowStatusChange(previousStatus, workflowStatus); // Émet un événement pour signaler le changement d'état
    }

    /**
     * @dev Retourne la proposition gagnante après la comptabilisation des votes.
     * @notice Cette fonction ne peut être appelée qu'après la comptabilisation des votes.
     * @return Description de la proposition gagnante.
     */
    function getWinningProposal() external view returns (string memory) {
        require(workflowStatus == WorkflowStatus.VotesTallied, "Les votes ne sont pas encore comptabilises"); // Vérifie que les votes ont été comptabilisés
        return proposals[winningProposalId].description; // Retourne la description de la proposition gagnante
    }

    /**
     * @dev Fonction pour récupérer le vote d'un électeur spécifique (pour transparence).
     * @param _voter Adresse de l'électeur dont on veut consulter le vote.
     * @return hasVoted Indique si l'électeur a voté.
     * @return votedProposalId L'ID de la proposition votée (si l'électeur a voté).
     */
    function getVoterInfo(address _voter) external view onlyWhitelisted returns (bool hasVoted, uint votedProposalId) {
        Voter memory voter = voters[_voter];
        require(voter.isRegistered, "L'electeur n'est pas enregistre");
        return (voter.hasVoted, voter.votedProposalId);
    }

    /**
     * @dev Fonction pour récupérer le nombre total de propositions.
     * @return Nombre de propositions enregistrées.
     */
    function getProposalsCount() public view returns (uint) {
        return proposals.length;
    }

    /**
     * @dev Permet à l'administrateur de modifier le pourcentage de quorum requis.
     * @param _quorumPercentage Nouveau pourcentage de quorum (0-100).
     */
    function setQuorum(uint _quorumPercentage) external onlyAdmin {
        require(_quorumPercentage <= 100, "Le pourcentage doit etre entre 0 et 100");
        uint oldQuorum = quorumPercentage;
        quorumPercentage = _quorumPercentage;
        emit QuorumUpdated(oldQuorum, quorumPercentage);
    }

    /**
     * @dev Fonction pour obtenir le pourcentage de participation actuel.
     * @return Le pourcentage de participation actuel.
     */
    function getCurrentParticipation() external view returns (uint) {
        if (votersCount == 0) return 0;
        
        uint votesCount = 0;
        for (uint i = 0; i < proposals.length; i++) {
            votesCount += proposals[i].voteCount;
        }
        
        return (votesCount * 100) / votersCount;
    }
}