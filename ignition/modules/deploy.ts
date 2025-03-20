import { ethers } from "hardhat";
import { Signer } from "ethers";

async function main(): Promise<void> {
    const [deployer]: Signer[] = await ethers.getSigners();
    console.log("Déploiement avec le compte:", await deployer.getAddress());
    
    const VotingContract = await ethers.getContractFactory("Voting");
    // Si votre contrat a des paramètres de constructeur, ajoutez-les ici
    const votingContract = await VotingContract.deploy();
    
    await votingContract.waitForDeployment();
    
    console.log("Contrat déployé à l'adresse:", await votingContract.getAddress());
}

main()
    .then(() => process.exit(0))
    .catch((error: Error) => {
        console.error(error);
        process.exit(1);
    });