<template>

  <div>
    <KModal
      v-if="activeDialog"
      :title="dialogConfig.title"
      :submitText="dialogConfig.submitText"
      :cancelText="$tr('cancelAction')"
      :data-test="dialogConfig.testId"
      @submit="handleSubmit"
      @cancel="activeDialog = null"
    >
      <p>{{ dialogConfig.message }}</p>
    </KModal>

    <BaseMenu>
      <template #activator="{ on }">
        <VBtn
          v-bind="$attrs"
          v-on="on"
        >
          actions
          <Icon
            icon="dropdown"
            class="ml-1"
          />
        </VBtn>
      </template>
      <VList>
        <template v-if="channel.deleted">
          <VListTile
            data-test="restore"
            @click="openDialog('restore')"
          >
            <VListTileTitle>Restore</VListTileTitle>
          </VListTile>
          <VListTile
            data-test="delete"
            @click="openDialog('permanentDelete')"
          >
            <VListTileTitle>Delete permanently</VListTileTitle>
          </VListTile>
        </template>
        <template v-else>
          <VListTile
            :to="searchChannelEditorsLink"
            target="_blank"
          >
            <VListTileTitle>View editors</VListTileTitle>
          </VListTile>
          <VListTile
            data-test="pdf"
            @click="downloadPDF"
          >
            <VListTileTitle>Download PDF</VListTileTitle>
          </VListTile>
          <VListTile
            data-test="csv"
            @click="downloadCSV"
          >
            <VListTileTitle>Download CSV</VListTileTitle>
          </VListTile>
          <VListTile
            v-if="channel.public"
            data-test="private"
            @click="openDialog('makePrivate')"
          >
            <VListTileTitle>Make private</VListTileTitle>
          </VListTile>
          <VListTile
            v-else
            data-test="public"
            @click="openDialog('makePublic')"
          >
            <VListTileTitle>Make public</VListTileTitle>
          </VListTile>
          <VListTile
            v-if="!channel.public"
            data-test="softdelete"
            @click="openDialog('softDelete')"
          >
            <VListTileTitle>Delete channel</VListTileTitle>
          </VListTile>
        </template>
      </VList>
    </BaseMenu>
  </div>

</template>


<script>

  import { mapActions, mapGetters } from 'vuex';
  import { RouteNames } from '../../constants';
  import { channelExportMixin } from 'shared/views/channel/mixins';

  export default {
    name: 'ChannelActionsDropdown',
    mixins: [channelExportMixin],
    props: {
      channelId: {
        type: String,
        required: true,
      },
    },
    data: () => ({
      activeDialog: null,
    }),
    computed: {
      ...mapGetters('channel', ['getChannel']),
      channel() {
        return this.getChannel(this.channelId);
      },
      name() {
        return this.channel.name;
      },
      searchChannelEditorsLink() {
        return {
          name: RouteNames.USERS,
          query: {
            keywords: `${this.channel.id}`,
          },
        };
      },
      dialogConfig() {
        const configs = {
          restore: {
            title: this.$tr('restoreChannelTitle'),
            submitText: this.$tr('restoreAction'),
            message: this.$tr('restoreChannelMessage', { name: this.name }),
            testId: 'confirm-restore',
            handler: this.restoreHandler,
          },
          makePublic: {
            title: this.$tr('makePublicTitle'),
            submitText: this.$tr('makePublicAction'),
            message: this.$tr('makePublicMessage', { name: this.name }),
            testId: 'confirm-public',
            handler: this.makePublicHandler,
          },
          makePrivate: {
            title: this.$tr('makePrivateTitle'),
            submitText: this.$tr('makePrivateAction'),
            message: this.$tr('makePrivateMessage', { name: this.name }),
            testId: 'confirm-private',
            handler: this.makePrivateHandler,
          },
          permanentDelete: {
            title: this.$tr('permanentDeleteTitle'),
            submitText: this.$tr('permanentDeleteAction'),
            message: this.$tr('permanentDeleteMessage', { name: this.name }),
            testId: 'confirm-delete',
            handler: this.deleteHandler,
          },
          softDelete: {
            title: this.$tr('softDeleteTitle'),
            submitText: this.$tr('softDeleteAction'),
            message: this.$tr('softDeleteMessage', { name: this.name }),
            testId: 'confirm-softdelete',
            handler: this.softDeleteHandler,
          },
        };
        return configs[this.activeDialog] || {};
      },
    },
    methods: {
      ...mapActions('channelAdmin', [
        'getAdminChannelListDetails',
        'deleteChannel',
        'updateChannel',
      ]),
      openDialog(type) {
        this.activeDialog = type;
      },
      handleSubmit() {
        if (this.dialogConfig.handler) {
          this.dialogConfig.handler();
        }
        this.activeDialog = null;
      },
      async downloadPDF() {
        this.$store.dispatch('showSnackbarSimple', 'Generating PDF...');
        const channelList = await this.getAdminChannelListDetails([this.channel.id]);
        return this.generateChannelsPDF(channelList);
      },
      async downloadCSV() {
        this.$store.dispatch('showSnackbarSimple', 'Generating CSV...');
        const channelList = await this.getAdminChannelListDetails([this.channel.id]);
        return this.generateChannelsCSV(channelList);
      },
      restoreHandler() {
        this.updateChannel({
          id: this.channelId,
          deleted: false,
        }).then(() => {
          this.$store.dispatch('showSnackbarSimple', 'Channel restored');
        });
      },
      softDeleteHandler() {
        this.updateChannel({
          id: this.channelId,
          deleted: true,
        }).then(() => {
          this.$store.dispatch('showSnackbarSimple', 'Channel deleted');
        });
      },
      deleteHandler() {
        this.$emit('deleted');
        return this.deleteChannel(this.channelId).then(() => {
          this.$store.dispatch('showSnackbarSimple', 'Channel deleted permanently');
        });
      },
      makePublicHandler() {
        this.updateChannel({
          id: this.channelId,
          isPublic: true,
        }).then(() => {
          this.$store.dispatch('showSnackbarSimple', 'Channel changed to public');
        });
      },
      makePrivateHandler() {
        this.updateChannel({
          id: this.channelId,
          isPublic: false,
        }).then(() => {
          this.$store.dispatch('showSnackbarSimple', 'Channel changed to private');
        });
      },
    },
    $trs: {
      restoreChannelTitle: 'Restore channel',
      restoreAction: 'Restore',
      cancelAction: 'Cancel',
      restoreChannelMessage: 'Are you sure you want to restore {name} and make it active again?',

      makePublicTitle: 'Make channel public',
      makePublicAction: 'Make public',
      makePublicMessage: 'All users will be able to view and import content from {name}.',

      makePrivateTitle: 'Make channel private',
      makePrivateAction: 'Make private',
      makePrivateMessage:
        'Only users with view-only or edit permissions will be able to access {name}.',

      permanentDeleteTitle: 'Permanently delete channel',
      permanentDeleteAction: 'Delete permanently',
      permanentDeleteMessage:
        'Are you sure you want to permanently delete {name}? This can not be undone.',

      softDeleteTitle: 'Delete channel',
      softDeleteAction: 'Delete',
      softDeleteMessage: 'Are you sure you want to delete {name}?',
    },
  };

</script>


<style lang="scss" scoped></style>
