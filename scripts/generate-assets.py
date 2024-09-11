from pathlib import Path
import shutil


def convert_id_to_str(id: int) -> str:
    return chr(id + 97)


###
### AppAgents
###


def get_app_agent_relative_dir(app_agent_id: int) -> str:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    return f"game-{app_agent_id_str}/app-agent-{app_agent_id_str}"


def get_app_agent_meta_path(target_dir: Path, app_agent_id: int) -> Path:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    return target_dir / get_app_agent_relative_dir(app_agent_id) / f"app-agent-{app_agent_id_str}.json"


def get_app_agent_meta(*, app_agent_id: int, cdn_base_url: str) -> str:
    template = """{
        "metadata_id": "APP-AGENT-ID",
        "title": "Metadata of the demo AppAgent that represents the game GAME-NAME.",
        "description": "Metadata of the demo AppAgent that represents the game GAME-NAME.",
        "traits": {
            "named": {
                "name": "GAME-NAME"
            },
            "tech.trait.wallet.square_icon": {
                "image_url": "ICON-URL"
            }
        }
    }
    """

    app_agent_id_str = convert_id_to_str(app_agent_id)
    template = template.replace("APP-AGENT-ID", f"demo-app-agent-{app_agent_id_str}")

    icon_url = f"{cdn_base_url}/{get_app_agent_relative_dir(app_agent_id)}/icon_150x150.png"
    template = template.replace("ICON-URL", icon_url)

    return template


###
### Fungibles
###


def get_fungible_relative_dir(app_agent_id: int, fungible_id: int) -> str:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    fungible_id_str = convert_id_to_str(fungible_id)
    return f"game-{app_agent_id_str}/fungible-{app_agent_id_str}-{fungible_id_str}"


def get_fungible_meta_path(target_dir: Path, app_agent_id: int, fungible_id: int) -> Path:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    fungible_id_str = convert_id_to_str(fungible_id)
    return (
        target_dir
        / get_fungible_relative_dir(app_agent_id, fungible_id)
        / f"fungible-{app_agent_id_str}-{fungible_id_str}.json"
    )


def get_fungible_meta(*, app_agent_id: int, fungible_id: int, cdn_base_url: str) -> str:
    template = """{
        "metadata_id": "FUNGIBLE-ID",
        "title": "Metadata of the demo fungible token for the game GAME-NAME.",
        "description": "Metadata of the demo fungible token for the game GAME-NAME.",
        "traits": {
            "named": {
                "name": "FUNGIBLE-NAME"
            },
            "fungible": {
                "symbol": "FUNGIBLE-SYMBOL",
                "decimals": "FUNGIBLE-DECIMALS"
            },
            "tech.trait.wallet.square_icon": {
                "image_url": "ICON-URL"
            }
        }
    }
    """

    app_agent_id_str = convert_id_to_str(app_agent_id)
    fungible_id_str = convert_id_to_str(fungible_id)
    template = template.replace("FUNGIBLE-ID", f"demo-fungible-{app_agent_id_str}-{fungible_id_str}")

    icon_url = f"{cdn_base_url}/{get_fungible_relative_dir(app_agent_id, fungible_id)}/icon_150x150.png"
    template = template.replace("ICON-URL", icon_url)

    return template


###
### NFT collections
###


def get_nft_collection_relative_dir(app_agent_id: int, nft_collection_id: int) -> str:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    nft_collection_id_str = convert_id_to_str(nft_collection_id)
    return f"game-{app_agent_id_str}/nft-collection-{app_agent_id_str}-{nft_collection_id_str}/nft-collection-{app_agent_id_str}-{nft_collection_id_str}"


def get_nft_collection_meta_path(target_dir: Path, app_agent_id: int, nft_collection_id: int) -> Path:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    nft_collection_id_str = convert_id_to_str(nft_collection_id)
    return (
        target_dir
        / get_nft_collection_relative_dir(app_agent_id, nft_collection_id)
        / f"nft-collection-{app_agent_id_str}-{nft_collection_id_str}.json"
    )


def get_nft_collection_meta(*, app_agent_id: int, nft_collection_id: int, cdn_base_url: str) -> str:
    template = """{
        "metadata_id": "NFT-COLLECTION-ID",
        "title": "Metadata of the demo NFT collection for the game GAME-NAME.",
        "description": "Metadata of the demo NFT collection for the game GAME-NAME.",
        "traits": {
            "named": {
                "name": "NFT-COLLECTION-NAME"
            },
            "tech.trait.wallet.square_icon": {
                "image_url": "ICON-URL"
            },
            "tech.trait.wallet.nft_collection_listing_image": {
                "image_url": "LISTING-IMAGE-URL"
            }
        }
    }
    """

    app_agent_id_str = convert_id_to_str(app_agent_id)
    nft_collection_id_str = convert_id_to_str(nft_collection_id)
    template = template.replace(
        "NFT-COLLECTION-ID",
        f"demo-nft-collection-{app_agent_id_str}-{nft_collection_id_str}",
    )

    icon_url = f"{cdn_base_url}/{get_nft_collection_relative_dir(app_agent_id, nft_collection_id)}/icon_150x150.png"
    template = template.replace("ICON-URL", icon_url)

    listing_image_url = (
        f"{cdn_base_url}/{get_nft_collection_relative_dir(app_agent_id, nft_collection_id)}/listing_512x512.png"
    )
    template = template.replace("LISTING-IMAGE-URL", listing_image_url)

    return template


###
### NFT tokens
###


def get_nft_token_relative_dir(app_agent_id: int, nft_collection_id: int, nft_token_id: int) -> str:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    nft_collection_id_str = convert_id_to_str(nft_collection_id)
    nft_token_id_str = convert_id_to_str(nft_token_id)
    return f"game-{app_agent_id_str}/nft-collection-{app_agent_id_str}-{nft_collection_id_str}/nft-token-{app_agent_id_str}-{nft_collection_id_str}-{nft_token_id_str}"


def get_nft_token_meta_path(target_dir: Path, app_agent_id: int, nft_collection_id: int, nft_token_id: int) -> Path:
    app_agent_id_str = convert_id_to_str(app_agent_id)
    nft_collection_id_str = convert_id_to_str(nft_collection_id)
    nft_token_id_str = convert_id_to_str(nft_token_id)
    return (
        target_dir
        / get_nft_token_relative_dir(app_agent_id, nft_collection_id, nft_token_id)
        / f"nft-token-{app_agent_id_str}-{nft_collection_id_str}-{nft_token_id_str}.json"
    )


def get_nft_token_meta(*, app_agent_id: int, nft_collection_id: int, nft_token_id: int, cdn_base_url: str) -> str:
    template = """{
        "metadata_id": "NFT-TOKEN-ID",
        "title": "Metadata of the demo NFT token for the game GAME-NAME.",
        "description": "Metadata of the demo NFT token for the game GAME-NAME.",
        "traits": {
            "named": {
                "name": "NFT-TOKEN-NAME"
            },
            "tech.trait.wallet.square_icon": {
                "image_url": "ICON-URL"
            },
            "tech.trait.wallet.nft_token_listing_image": {
                "image_url": "LISTING-IMAGE-URL"
            },
            "tech.trait.wallet.nft_token_cover_image": {
                "image_url": "COVER-IMAGE-URL"
            },
            "tech.trait.wallet.nft_token_description": {
                "nft_token_description": "DESCRIPTION-OF-NFT-TOKEN"
            },
            "tech.trait.wallet.nft_token_attributes": {
                "attributes": [
                    {
                        "name": "Number attribute",
                        "display_type": "number",
                        "value": 123
                    },
                    {
                        "name": "Percentage attribute",
                        "display_type": "percentage",
                        "value": -17
                    },
                    {
                        "name": "String attribute",
                        "display_type": "string",
                        "value": "Some string"
                    },
                    {
                        "name": "Boolean attribute",
                        "display_type": "boolean",
                        "value": true
                    },
                    {
                        "name": "Date attribute 1",
                        "display_type": "date",
                        "value": "2018-11-13T20:20:39+00:00"
                    },
                    {
                        "name": "Date attribute 2",
                        "display_type": "date",
                        "value": "2018-11-13"
                    },
                    {
                        "name": "Date attribute 3",
                        "display_type": "date",
                        "value": "20:20:39+00:00"
                    },
                    {
                        "name": "Duration attribute",
                        "display_type": "duration",
                        "value": "P3D"
                    }
                ]
            }
        }
    }
    """

    app_agent_id_str = convert_id_to_str(app_agent_id)
    nft_collection_id_str = convert_id_to_str(nft_collection_id)
    nft_token_id_str = convert_id_to_str(nft_token_id)
    template = template.replace(
        "NFT-TOKEN-ID",
        f"demo-nft-token-{app_agent_id_str}-{nft_collection_id_str}-{nft_token_id_str}",
    )

    icon_url = (
        f"{cdn_base_url}/{get_nft_token_relative_dir(app_agent_id, nft_collection_id, nft_token_id)}/icon_150x150.png"
    )
    template = template.replace("ICON-URL", icon_url)

    listing_image_url = (
        f"{cdn_base_url}/{get_nft_token_relative_dir(app_agent_id, nft_collection_id, nft_token_id)}/listing_512x512.png"
    )
    template = template.replace("LISTING-IMAGE-URL", listing_image_url)

    cover_image_url = (
        f"{cdn_base_url}/{get_nft_token_relative_dir(app_agent_id, nft_collection_id, nft_token_id)}/cover_1920x1920.png"
    )
    template = template.replace("COVER-IMAGE-URL", cover_image_url)

    return template


###
### Create files
###


def generate_game_metadata(
    *,
    target_dir: Path,
    cdn_base_url: str,
    app_agent_id: int,
    number_of_fungibles: int,
    number_of_nft_collections: int,
    paste_stub_images: bool = True,
) -> None:
    # create dir
    target_dir.mkdir(parents=True, exist_ok=True)

    # Get path to stub images
    icon_stub_path = Path(__file__).parent / "trait-logo-150.png"
    listing_image_stub_path = Path(__file__).parent / "trait-logo-512.png"
    cover_image_stub_path = Path(__file__).parent / "trait-logo-1920.png"

    # AppAgent
    app_agent_dir = target_dir / get_app_agent_relative_dir(app_agent_id)
    app_agent_dir.mkdir(parents=True, exist_ok=True)
    app_agent_meta_path = get_app_agent_meta_path(target_dir, app_agent_id)
    app_agent_meta_path.write_text(
        get_app_agent_meta(app_agent_id=app_agent_id, cdn_base_url=cdn_base_url),
        encoding="utf-8",
    )

    if paste_stub_images:
        (app_agent_dir / "icon_150x150.png").write_bytes(icon_stub_path.read_bytes())

    for fungible_id in range(number_of_fungibles):
        fungible_dir = target_dir / get_fungible_relative_dir(app_agent_id, fungible_id)
        fungible_dir.mkdir(parents=True, exist_ok=True)
        fungible_meta_path = get_fungible_meta_path(target_dir, app_agent_id, fungible_id)
        fungible_meta_path.write_text(
            get_fungible_meta(
                app_agent_id=app_agent_id,
                fungible_id=fungible_id,
                cdn_base_url=cdn_base_url,
            ),
            encoding="utf-8",
        )

        if paste_stub_images:
            (fungible_dir / "icon_150x150.png").write_bytes(icon_stub_path.read_bytes())

    for nft_collection_id in range(number_of_nft_collections):
        nft_collection_dir = target_dir / get_nft_collection_relative_dir(app_agent_id, nft_collection_id)
        nft_collection_dir.mkdir(parents=True, exist_ok=True)
        nft_collection_meta_path = get_nft_collection_meta_path(target_dir, app_agent_id, nft_collection_id)
        nft_collection_meta_path.write_text(
            get_nft_collection_meta(
                app_agent_id=app_agent_id,
                nft_collection_id=nft_collection_id,
                cdn_base_url=cdn_base_url,
            ),
            encoding="utf-8",
        )

        if paste_stub_images:
            (nft_collection_dir / "icon_150x150.png").write_bytes(icon_stub_path.read_bytes())
            (nft_collection_dir / "listing_512x512.png").write_bytes(listing_image_stub_path.read_bytes())

        for nft_token_id in range(10):
            nft_token_dir = target_dir / get_nft_token_relative_dir(app_agent_id, nft_collection_id, nft_token_id)
            nft_token_dir.mkdir(parents=True, exist_ok=True)
            nft_token_meta_path = get_nft_token_meta_path(target_dir, app_agent_id, nft_collection_id, nft_token_id)
            nft_token_meta_path.write_text(
                get_nft_token_meta(
                    app_agent_id=app_agent_id,
                    nft_collection_id=nft_collection_id,
                    nft_token_id=nft_token_id,
                    cdn_base_url=cdn_base_url,
                ),
                encoding="utf-8",
            )

            if paste_stub_images:
                (nft_token_dir / "icon_150x150.png").write_bytes(icon_stub_path.read_bytes())
                (nft_token_dir / "listing_512x512.png").write_bytes(listing_image_stub_path.read_bytes())
                (nft_token_dir / "cover_1920x1920.png").write_bytes(cover_image_stub_path.read_bytes())


# Delete old content
aws_s3_assets_dir = Path(__file__).parent.parent / "aws_s3_assets"
shutil.rmtree(aws_s3_assets_dir)

# Create new content
generate_game_metadata(
    target_dir=aws_s3_assets_dir,
    cdn_base_url="https://trait-wallet-demo-account.trait.tech",
    app_agent_id=0,
    number_of_fungibles=3,
    number_of_nft_collections=5,
    paste_stub_images=True,
)
generate_game_metadata(
    target_dir=aws_s3_assets_dir,
    cdn_base_url="https://trait-wallet-demo-account.trait.tech",
    app_agent_id=1,
    number_of_fungibles=2,
    number_of_nft_collections=4,
    paste_stub_images=True,
)
generate_game_metadata(
    target_dir=aws_s3_assets_dir,
    cdn_base_url="https://trait-wallet-demo-account.trait.tech",
    app_agent_id=2,
    number_of_fungibles=1,
    number_of_nft_collections=4,
    paste_stub_images=True,
)