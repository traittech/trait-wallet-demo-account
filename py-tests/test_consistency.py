import json
import unittest
from pathlib import Path

from traitsvalidator import TraitsValidator


class TestConfig:
    GIT_REPO_ROOT: Path = Path(__file__).parent.parent
    AWS_S3_ASSETS_DIR: Path = GIT_REPO_ROOT / "aws_s3_assets"


class TestRegistry(unittest.TestCase):
    def test_validation_of_traits(self: "TestRegistry") -> None:
        """
        Validate metadata of on-chain assets with traits schema.

        This function iterates over all metadata files in the AWS S3 dir,
        validates their traits.
        """
        validator = TraitsValidator()

        # Collect list of all metadata files
        meta_app_agents = []
        meta_fungibles = []
        meta_nft_collections = []
        meta_nft_tokens = []

        # Find all files from directory
        # Iterate over files in directory
        for filename in Path(TestConfig.AWS_S3_ASSETS_DIR).rglob("*.json"):
            print(filename)
            if filename.is_file() and filename.name.endswith(".json"):
                if "app-agent" in filename.name:
                    meta_app_agents.append(filename)
                elif "fungible" in filename.name:
                    meta_fungibles.append(filename)
                elif "nft-collection" in filename.name:
                    meta_nft_collections.append(filename)
                elif "nft-token" in filename.name:
                    meta_nft_tokens.append(filename)
                else:
                    msg = f"Unknown metadata file: {filename}"
                    raise ValueError(msg)

        # Validate AppAgent metadata
        for meta_path in meta_app_agents:
            with meta_path.open() as fp:
                appagent_meta = json.load(fp)
            available_traits = validator.validate_metadata(appagent_meta)
            self.assertEqual(
                available_traits,
                ["named", "tech.trait.wallet.square_icon"],
                f"Unexpected set of traits in the file {meta_path}",
            )

        # Validate metadata of fungible token
        for meta_path in meta_fungibles:
            with meta_path.open() as fp:
                fungible_meta = json.load(fp)
            available_traits = validator.validate_metadata(fungible_meta)
            self.assertEqual(
                available_traits,
                ["named", "fungible", "tech.trait.wallet.square_icon"],
                f"Unexpected set of traits in the file {meta_path}",
            )

        # Validate metadata of nft collection
        for meta_path in meta_nft_collections:
            with meta_path.open() as fp:
                nft_collection_meta = json.load(fp)
            available_traits = validator.validate_metadata(nft_collection_meta)
            self.assertEqual(
                available_traits,
                [
                    "named",
                    "tech.trait.wallet.square_icon",
                    "tech.trait.wallet.nft_collection_listing_image",
                ],
                f"Unexpected set of traits in the file {meta_path}",
            )

        # Validate metadata of nft token
        for meta_path in meta_nft_tokens:
            with meta_path.open() as fp:
                nft_token_meta = json.load(fp)
            available_traits = validator.validate_metadata(nft_token_meta)
            self.assertEqual(
                available_traits,
                [
                    "named",
                    "tech.trait.wallet.square_icon",
                    "tech.trait.wallet.nft_token_listing_image",
                    "tech.trait.wallet.nft_token_cover_image",
                    "tech.trait.wallet.nft_token_description",
                    "tech.trait.wallet.nft_token_attributes",
                ],
                f"Unexpected set of traits in the file {meta_path}",
            )
