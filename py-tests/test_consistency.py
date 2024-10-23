import http
import json
import unittest
from pathlib import Path

import requests
from traitsvalidator import TraitsValidator


class TestConfig:
    GIT_REPO_ROOT: Path = Path(__file__).parent.parent
    AWS_S3_ASSETS_DIR: Path = GIT_REPO_ROOT / "aws_s3_assets_staging"
    CDN_URL = f"http://trait-wallet-demo-account-staging.trait.tech"
    HTTP_TIMEOUT = 2


class TestAssets(unittest.TestCase):
    def collect_all_meta(self: "TestAssets") -> tuple[list[Path], list[Path], list[Path], list[Path]]:
        """
        Validate metadata of on-chain assets with traits schema.

        This function iterates over all metadata files in the AWS S3 dir,
        validates their traits.
        """
        # Collect list of all metadata files
        meta_app_agents = []
        meta_fungibles = []
        meta_nft_collections = []
        meta_nft_tokens = []

        # Find all files from directory
        # Iterate over files in directory
        for filename in Path(TestConfig.AWS_S3_ASSETS_DIR).rglob("*.json"):
            # print(filename)
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
                
        return meta_app_agents, meta_fungibles, meta_nft_collections, meta_nft_tokens

    def test_validate_local_meta(self: "TestAssets") -> None:
        """
        Validate metadata of on-chain assets stored in the repo.

        This function iterates over all metadata files in the AWS S3 dir, validates their traits.
        It also checks existince of the images refered in metadata files.
        """
        validator = TraitsValidator()

        # Collect list of all metadata files
        all_meta = self.collect_all_meta()
        meta_app_agents = all_meta[0]
        meta_fungibles = all_meta[1]
        meta_nft_collections = all_meta[2]
        meta_nft_tokens = all_meta[3]

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

            icon_url: str = appagent_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            icon_path = icon_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(icon_path).is_file(), f"Can't find a file {Path(icon_path)}")
            self.assertTrue(Path(icon_path).name.endswith(".png"))


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

            icon_url: str = fungible_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            icon_path = icon_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(icon_path).is_file())
            self.assertTrue(Path(icon_path).name.endswith(".png"))

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

            icon_url: str = nft_collection_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            icon_path = icon_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(icon_path).is_file())
            self.assertTrue(Path(icon_path).name.endswith(".png"))
            listing_url: str = nft_collection_meta["traits"]["tech.trait.wallet.nft_collection_listing_image"]["image_url"]
            listing_path = listing_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(listing_path).is_file())
            self.assertTrue(Path(listing_path).name.endswith(".png"))

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

            icon_url: str = nft_token_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            icon_path = icon_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(icon_path).is_file())
            self.assertTrue(Path(icon_path).name.endswith(".png"))
            listing_url: str = nft_token_meta["traits"]["tech.trait.wallet.nft_token_listing_image"]["image_url"]
            listing_path = listing_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(listing_path).is_file())
            self.assertTrue(Path(listing_path).name.endswith(".png"))
            cover_url: str = nft_token_meta["traits"]["tech.trait.wallet.nft_token_cover_image"]["image_url"]
            cover_path = cover_url.replace(TestConfig.CDN_URL, str(TestConfig.AWS_S3_ASSETS_DIR))
            self.assertTrue(Path(cover_path).is_file())
            self.assertTrue(Path(cover_path).name.endswith(".png"))

    def test_validate_cdn_meta(self: "TestAssets") -> None:
        """
        Validate metadata of on-chain assets stored in the AWS CDN, distributed via CDN.

        This function iterates over all metadata files in the AWS CDN, validates their traits.
        It also checks existince of the images refered in metadata files.
        """
        validator = TraitsValidator()

        # Collect list of all metadata files
        all_meta = self.collect_all_meta()
        meta_app_agents = all_meta[0]
        meta_fungibles = all_meta[1]
        meta_nft_collections = all_meta[2]
        meta_nft_tokens = all_meta[3]

        # Validate AppAgent metadata
        for meta_path in meta_app_agents:
            meta_url = str(meta_path).replace(str(TestConfig.AWS_S3_ASSETS_DIR), TestConfig.CDN_URL)
            resp = requests.get(url=meta_url, timeout=TestConfig.HTTP_TIMEOUT)
            if resp.status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the metadata file in the CDN: `{meta_url}`."
                raise ValueError(msg)
            appagent_meta = resp.json()

            available_traits = validator.validate_metadata(appagent_meta)
            self.assertEqual(
                available_traits,
                ["named", "tech.trait.wallet.square_icon"],
                f"Unexpected set of traits in the file {meta_path}",
            )

            icon_url: str = appagent_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            if requests.get(url=icon_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{icon_url}`."
                raise ValueError(msg)


        # Validate metadata of fungible token
        for meta_path in meta_fungibles:
            meta_url = str(meta_path).replace(str(TestConfig.AWS_S3_ASSETS_DIR), TestConfig.CDN_URL)
            resp = requests.get(url=meta_url, timeout=TestConfig.HTTP_TIMEOUT)
            if resp.status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the metadata file in the CDN: `{meta_url}`."
                raise ValueError(msg)
            fungible_meta = resp.json()

            available_traits = validator.validate_metadata(fungible_meta)
            self.assertEqual(
                available_traits,
                ["named", "fungible", "tech.trait.wallet.square_icon"],
                f"Unexpected set of traits in the file {meta_path}",
            )

            icon_url: str = fungible_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            if requests.get(url=icon_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{icon_url}`."
                raise ValueError(msg)

        # Validate metadata of nft collection
        for meta_path in meta_nft_collections:
            meta_url = str(meta_path).replace(str(TestConfig.AWS_S3_ASSETS_DIR), TestConfig.CDN_URL)
            resp = requests.get(url=meta_url, timeout=TestConfig.HTTP_TIMEOUT)
            if resp.status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the metadata file in the CDN: `{meta_url}`."
                raise ValueError(msg)
            nft_collection_meta = resp.json()

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

            icon_url: str = nft_collection_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            if requests.get(url=icon_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{icon_url}`."
                raise ValueError(msg)
            listing_url: str = nft_collection_meta["traits"]["tech.trait.wallet.nft_collection_listing_image"]["image_url"]
            if requests.get(url=listing_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{listing_url}`."
                raise ValueError(msg)

        # Validate metadata of nft token
        for meta_path in meta_nft_tokens:
            meta_url = str(meta_path).replace(str(TestConfig.AWS_S3_ASSETS_DIR), TestConfig.CDN_URL)
            resp = requests.get(url=meta_url, timeout=TestConfig.HTTP_TIMEOUT)
            if resp.status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the metadata file in the CDN: `{meta_url}`."
                raise ValueError(msg)
            nft_token_meta = resp.json()

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

            icon_url: str = nft_token_meta["traits"]["tech.trait.wallet.square_icon"]["image_url"]
            if requests.get(url=icon_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{icon_url}`."
                raise ValueError(msg)
            listing_url: str = nft_token_meta["traits"]["tech.trait.wallet.nft_token_listing_image"]["image_url"]
            if requests.get(url=listing_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{listing_url}`."
                raise ValueError(msg)
            cover_url: str = nft_token_meta["traits"]["tech.trait.wallet.nft_token_cover_image"]["image_url"]
            if requests.get(url=cover_url, timeout=TestConfig.HTTP_TIMEOUT).status_code != http.HTTPStatus.OK:
                msg = f"Couldn't find the image in the CDN: `{cover_url}`."
                raise ValueError(msg)
